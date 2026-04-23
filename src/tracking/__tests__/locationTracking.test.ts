const mockIsAvailableAsync = jest.fn();
const mockGetBatteryLevelAsync = jest.fn();
const mockHasStartedLocationUpdatesAsync = jest.fn();
const mockStartLocationUpdatesAsync = jest.fn();
const mockStopLocationUpdatesAsync = jest.fn();
const mockRequestForegroundPermissionsAsync = jest.fn();
const mockRequestBackgroundPermissionsAsync = jest.fn();

jest.mock("expo-battery", () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  getBatteryLevelAsync: () => mockGetBatteryLevelAsync(),
}));

jest.mock("expo-location", () => ({
  LocationAccuracy: {
    BestForNavigation: "BEST",
    Balanced: "BALANCED",
  },
  LocationActivityType: {
    Fitness: "FITNESS",
  },
  PermissionStatus: {
    GRANTED: "granted",
  },
  hasStartedLocationUpdatesAsync: (...args: unknown[]) =>
    mockHasStartedLocationUpdatesAsync(...args),
  startLocationUpdatesAsync: (...args: unknown[]) =>
    mockStartLocationUpdatesAsync(...args),
  stopLocationUpdatesAsync: (...args: unknown[]) =>
    mockStopLocationUpdatesAsync(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...args),
  requestBackgroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestBackgroundPermissionsAsync(...args),
}));

jest.mock("../../location/currentLocationCache", () => ({
  onPermissionGranted: jest.fn(() => Promise.resolve(null)),
  reconcileForegroundWatch: jest.fn(() => Promise.resolve()),
}));

/**
 * Tests high-level tracking control that configures Expo background updates.
 *
 * Coverage in this suite:
 * - Start flow chooses accuracy mode from battery state (high vs reduced).
 * - Existing tracking sessions are restarted to apply updated configuration.
 * - Runtime refresh only reconfigures when tracking is currently active and
 *   desired accuracy mode differs from the mode already applied.
 * - Journey-status sync enforces permission gating for start and stops updates
 *   when journey leaves an active tracking state (for example paused).
 */
describe("locationTracking", () => {
  beforeEach(() => {
    jest.resetModules();
    mockIsAvailableAsync.mockReset();
    mockGetBatteryLevelAsync.mockReset();
    mockHasStartedLocationUpdatesAsync.mockReset();
    mockStartLocationUpdatesAsync.mockReset();
    mockStopLocationUpdatesAsync.mockReset();
    mockRequestForegroundPermissionsAsync.mockReset();
    mockRequestBackgroundPermissionsAsync.mockReset();
  });

  it("starts updates with high accuracy when battery is healthy", async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    mockGetBatteryLevelAsync.mockResolvedValue(0.5);
    mockHasStartedLocationUpdatesAsync.mockResolvedValue(false);

    const {
      startOngoingLocationTracking,
    } = require("../locationTracking") as typeof import("../locationTracking");
    await startOngoingLocationTracking();

    expect(mockStopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mockStartLocationUpdatesAsync).toHaveBeenCalledWith(
      "MAP_MY_TRIP_BG_LOCATION",
      expect.objectContaining({ accuracy: "BEST" }),
    );
  });

  it("uses reduced accuracy below battery threshold and restarts when already running", async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    mockGetBatteryLevelAsync.mockResolvedValue(0.05);
    mockHasStartedLocationUpdatesAsync.mockResolvedValue(true);

    const {
      startOngoingLocationTracking,
    } = require("../locationTracking") as typeof import("../locationTracking");
    await startOngoingLocationTracking();

    expect(mockStopLocationUpdatesAsync).toHaveBeenCalledWith(
      "MAP_MY_TRIP_BG_LOCATION",
    );
    expect(mockStartLocationUpdatesAsync).toHaveBeenCalledWith(
      "MAP_MY_TRIP_BG_LOCATION",
      expect.objectContaining({ accuracy: "BALANCED" }),
    );
  });

  it("refreshes tracking only when running and mode changed", async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    mockGetBatteryLevelAsync.mockResolvedValue(0.5);
    mockHasStartedLocationUpdatesAsync.mockResolvedValue(false);

    const {
      startOngoingLocationTracking,
      refreshLocationTrackingAccuracyIfRunning,
    } = require("../locationTracking") as typeof import("../locationTracking");

    // Prime current mode to "high".
    await startOngoingLocationTracking();
    mockStartLocationUpdatesAsync.mockClear();

    // Not running -> no action.
    mockHasStartedLocationUpdatesAsync.mockResolvedValue(false);
    await refreshLocationTrackingAccuracyIfRunning();
    expect(mockStartLocationUpdatesAsync).not.toHaveBeenCalled();

    // Running with lower battery -> restart with reduced accuracy.
    mockHasStartedLocationUpdatesAsync.mockResolvedValue(true);
    mockGetBatteryLevelAsync.mockResolvedValue(0.05);
    await refreshLocationTrackingAccuracyIfRunning();
    expect(mockStopLocationUpdatesAsync).toHaveBeenCalledWith(
      "MAP_MY_TRIP_BG_LOCATION",
    );
    expect(mockStartLocationUpdatesAsync).toHaveBeenCalledWith(
      "MAP_MY_TRIP_BG_LOCATION",
      expect.objectContaining({ accuracy: "BALANCED" }),
    );
  });

  it("syncs tracking by journey status and permission result", async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    mockGetBatteryLevelAsync.mockResolvedValue(0.5);
    mockHasStartedLocationUpdatesAsync.mockResolvedValue(false);

    const {
      syncBackgroundTrackingForJourneyStatus,
    } = require("../locationTracking") as typeof import("../locationTracking");

    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    await syncBackgroundTrackingForJourneyStatus("ongoing");
    expect(mockStartLocationUpdatesAsync).not.toHaveBeenCalled();

    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockRequestBackgroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    await syncBackgroundTrackingForJourneyStatus("ongoing");
    expect(mockStartLocationUpdatesAsync).toHaveBeenCalledTimes(1);

    mockHasStartedLocationUpdatesAsync.mockResolvedValue(true);
    await syncBackgroundTrackingForJourneyStatus("paused");
    expect(mockStopLocationUpdatesAsync).toHaveBeenCalledWith(
      "MAP_MY_TRIP_BG_LOCATION",
    );
  });
});
