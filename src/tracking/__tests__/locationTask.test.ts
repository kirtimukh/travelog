type TaskHandler = (payload: {
  data?: unknown;
  error?: Error | null;
}) => Promise<void>;

const mockDefineTask = jest.fn();
const mockOpenAppDatabase = jest.fn();
const mockGetJourneyById = jest.fn();
const mockGetLastLocationPointForJourney = jest.fn();
const mockInsertLocationPoint = jest.fn();
const mockGetActiveJourneyId = jest.fn();
const mockDistanceMeters = jest.fn();

let taskHandler: TaskHandler | null = null;

jest.mock("expo-task-manager", () => ({
  defineTask: (name: string, handler: TaskHandler) => {
    mockDefineTask(name);
    taskHandler = handler;
  },
}));

jest.mock("../../db/client", () => ({
  openAppDatabase: () => mockOpenAppDatabase(),
}));

jest.mock("../../db/journeys", () => ({
  getJourneyById: (...args: unknown[]) => mockGetJourneyById(...args),
}));

jest.mock("../../db/locationPoints", () => ({
  getLastLocationPointForJourney: (...args: unknown[]) =>
    mockGetLastLocationPointForJourney(...args),
  insertLocationPoint: (...args: unknown[]) => mockInsertLocationPoint(...args),
}));

jest.mock("../../storage/activeJourney", () => ({
  getActiveJourneyId: () => mockGetActiveJourneyId(),
}));

jest.mock("../../geo/distance", () => ({
  distanceMeters: (...args: unknown[]) => mockDistanceMeters(...args),
}));

function location(
  timestamp: number,
  latitude: number,
  longitude: number,
  accuracy = 10,
  speed: number | null = null,
  heading: number | null = null,
) {
  return {
    timestamp,
    coords: {
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
    },
  };
}

async function runTask(locations: unknown[]) {
  if (!taskHandler) {
    throw new Error("Task handler was not registered");
  }
  await taskHandler({ data: { locations }, error: null });
}

/**
 * Validates background location task ingestion and commit rules.
 *
 * Coverage in this suite:
 * - Registers the Expo task handler and drives it with synthetic locations.
 * - Commits the first acceptable sample for an active ongoing journey.
 * - Drops low-quality points (accuracy outside accepted threshold).
 * - Applies cadence gates for subsequent commits:
 *   - commit when moved far enough, or
 *   - commit when enough time elapsed since last stored point.
 * - Prevents writes when no active journey exists or journey is not ongoing.
 */
describe("locationTask", () => {
  beforeEach(() => {
    jest.resetModules();
    mockDefineTask.mockClear();
    mockOpenAppDatabase.mockReset();
    mockGetJourneyById.mockReset();
    mockGetLastLocationPointForJourney.mockReset();
    mockInsertLocationPoint.mockReset();
    mockGetActiveJourneyId.mockReset();
    mockDistanceMeters.mockReset();
    taskHandler = null;

    jest.isolateModules(() => {
      require("../locationTask");
    });
  });

  it("commits the first valid point for an ongoing journey", async () => {
    const db = {};
    mockGetActiveJourneyId.mockReturnValue(42);
    mockOpenAppDatabase.mockResolvedValue(db);
    mockGetJourneyById.mockResolvedValue({ id: 42, status: "ongoing" });
    mockGetLastLocationPointForJourney.mockResolvedValue(null);

    await runTask([location(1_000, 10.11, 20.22, 8, 2.5)]);

    expect(mockInsertLocationPoint).toHaveBeenCalledTimes(1);
    expect(mockInsertLocationPoint).toHaveBeenCalledWith(db, {
      journeyId: 42,
      lat: 10.11,
      lng: 20.22,
      timestamp: 1_000,
      speed: 2.5,
      heading: null,
      metadata: JSON.stringify(location(1_000, 10.11, 20.22, 8, 2.5)),
    });
  });

  it("discards inaccurate points", async () => {
    mockGetActiveJourneyId.mockReturnValue(42);

    await runTask([location(1_000, 10.11, 20.22, 21)]);

    expect(mockOpenAppDatabase).not.toHaveBeenCalled();
    expect(mockInsertLocationPoint).not.toHaveBeenCalled();
  });

  it("commits only when distance or elapsed time threshold is met", async () => {
    const db = {};
    mockGetActiveJourneyId.mockReturnValue(42);
    mockOpenAppDatabase.mockResolvedValue(db);
    mockGetJourneyById.mockResolvedValue({ id: 42, status: "ongoing" });
    mockGetLastLocationPointForJourney.mockResolvedValue({
      lat: 10,
      lng: 20,
      timestamp: 1_000,
    });
    mockDistanceMeters
      .mockReturnValueOnce(5) // no insert (dt=2000)
      .mockReturnValueOnce(12); // insert by distance

    await runTask([
      location(3_000, 10.001, 20.001, 5),
      location(4_000, 10.002, 20.002, 5),
      location(9_000, 10.003, 20.003, 5), // insert by time (dt=5000 from last inserted)
    ]);

    expect(mockInsertLocationPoint).toHaveBeenCalledTimes(2);
    expect(mockInsertLocationPoint).toHaveBeenNthCalledWith(1, db, {
      journeyId: 42,
      lat: 10.002,
      lng: 20.002,
      timestamp: 4_000,
      speed: null,
      heading: null,
      metadata: JSON.stringify(location(4_000, 10.002, 20.002, 5)),
    });
    expect(mockInsertLocationPoint).toHaveBeenNthCalledWith(2, db, {
      journeyId: 42,
      lat: 10.003,
      lng: 20.003,
      timestamp: 9_000,
      speed: null,
      heading: null,
      metadata: JSON.stringify(location(9_000, 10.003, 20.003, 5)),
    });
  });

  it("does not commit when active journey is missing or not ongoing", async () => {
    mockGetActiveJourneyId.mockReturnValue(null);
    await runTask([location(1_000, 1, 2)]);
    expect(mockInsertLocationPoint).not.toHaveBeenCalled();

    const db = {};
    mockGetActiveJourneyId.mockReturnValue(99);
    mockOpenAppDatabase.mockResolvedValue(db);
    mockGetJourneyById.mockResolvedValue({ id: 99, status: "paused" });
    await runTask([location(2_000, 3, 4)]);
    expect(mockInsertLocationPoint).not.toHaveBeenCalled();
  });

  it("logs warning and does not throw when db operations fail", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockGetActiveJourneyId.mockReturnValue(42);
    mockOpenAppDatabase.mockRejectedValue(new Error("db unavailable"));

    await expect(runTask([location(1_000, 10, 20, 5)])).resolves.toBeUndefined();
    expect(mockInsertLocationPoint).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[MAP_MY_TRIP_BG_LOCATION] failed to persist locations:"),
    );

    warnSpy.mockRestore();
  });

  it("ignores malformed locations with non-finite coordinates or timestamp", async () => {
    const db = {};
    mockGetActiveJourneyId.mockReturnValue(42);
    mockOpenAppDatabase.mockResolvedValue(db);
    mockGetJourneyById.mockResolvedValue({ id: 42, status: "ongoing" });
    mockGetLastLocationPointForJourney.mockResolvedValue(null);

    await runTask([
      {
        timestamp: Number.NaN,
        coords: { latitude: 1, longitude: 2, accuracy: 5, speed: null },
      },
      {
        timestamp: 2_000,
        coords: { latitude: Number.NaN, longitude: 2, accuracy: 5, speed: null },
      },
      {
        timestamp: 3_000,
        coords: { latitude: 1, longitude: Number.POSITIVE_INFINITY, accuracy: 5, speed: null },
      },
      location(4_000, 11.11, 22.22, 5),
    ]);

    expect(mockInsertLocationPoint).toHaveBeenCalledTimes(1);
    expect(mockInsertLocationPoint).toHaveBeenCalledWith(db, {
      journeyId: 42,
      lat: 11.11,
      lng: 22.22,
      timestamp: 4_000,
      speed: null,
      heading: null,
      metadata: JSON.stringify(location(4_000, 11.11, 22.22, 5)),
    });
  });

  it("persists heading in location points", async () => {
    const db = {};
    mockGetActiveJourneyId.mockReturnValue(42);
    mockOpenAppDatabase.mockResolvedValue(db);
    mockGetJourneyById.mockResolvedValue({ id: 42, status: "ongoing" });
    mockGetLastLocationPointForJourney.mockResolvedValue(null);

    await runTask([location(1_000, 10.11, 20.22, 5, 2.5, 125.4)]);

    expect(mockInsertLocationPoint).toHaveBeenCalledWith(db, {
      journeyId: 42,
      lat: 10.11,
      lng: 20.22,
      timestamp: 1_000,
      speed: 2.5,
      heading: 125.4,
      metadata: JSON.stringify(location(1_000, 10.11, 20.22, 5, 2.5, 125.4)),
    });
  });
});
