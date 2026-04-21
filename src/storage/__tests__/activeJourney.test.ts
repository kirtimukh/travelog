const store = new Map<string, string>();

const mockGetString = jest.fn((key: string) => store.get(key));
const mockSet = jest.fn((key: string, value: string) => {
  store.set(key, value);
});
const mockRemove = jest.fn((key: string) => {
  store.delete(key);
});

jest.mock("../mmkv", () => ({
  getAppStorage: () => ({
    getString: mockGetString,
    set: mockSet,
    remove: mockRemove,
  }),
}));

/**
 * Exercises active-journey persistence helpers backed by app MMKV storage.
 *
 * Coverage in this suite:
 * - `set/get/clear` roundtrip behavior, including string-to-number parsing.
 * - Invalid persisted values are safely treated as "no active journey".
 * - Session sync logic updates active journey for live statuses.
 * - Clear helpers only remove the active journey when ids match, protecting
 *   against accidental clears from stale completion events.
 */
describe("activeJourney storage helpers", () => {
  beforeEach(() => {
    store.clear();
    mockGetString.mockClear();
    mockSet.mockClear();
    mockRemove.mockClear();
  });

  it("supports set/get/clear and invalid values", () => {
    const {
      ACTIVE_JOURNEY_ID_KEY,
      getActiveJourneyId,
      setActiveJourneyId,
      clearActiveJourneyId,
    } = require("../activeJourney") as typeof import("../activeJourney");

    expect(getActiveJourneyId()).toBeNull();

    setActiveJourneyId(123);
    expect(mockSet).toHaveBeenCalledWith(ACTIVE_JOURNEY_ID_KEY, "123");
    expect(getActiveJourneyId()).toBe(123);

    store.set(ACTIVE_JOURNEY_ID_KEY, "not-a-number");
    expect(getActiveJourneyId()).toBeNull();

    clearActiveJourneyId();
    expect(mockRemove).toHaveBeenCalledWith(ACTIVE_JOURNEY_ID_KEY);
    expect(getActiveJourneyId()).toBeNull();
  });

  it("syncs and clears only when ids match", () => {
    const {
      getActiveJourneyId,
      syncActiveJourneySession,
      clearActiveJourneyIfMatches,
      setActiveJourneyId,
    } = require("../activeJourney") as typeof import("../activeJourney");

    syncActiveJourneySession(7, "ongoing");
    expect(getActiveJourneyId()).toBe(7);

    syncActiveJourneySession(8, "paused");
    expect(getActiveJourneyId()).toBe(8);

    // Non-matching completion should not clear active 8.
    syncActiveJourneySession(7, "completed");
    expect(getActiveJourneyId()).toBe(8);

    clearActiveJourneyIfMatches(7);
    expect(getActiveJourneyId()).toBe(8);

    clearActiveJourneyIfMatches(8);
    expect(getActiveJourneyId()).toBeNull();
  });
});
