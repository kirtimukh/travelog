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

describe("pmtiles config storage", () => {
  beforeEach(() => {
    store.clear();
    mockGetString.mockClear();
    mockSet.mockClear();
    mockRemove.mockClear();
  });

  it("roundtrips a valid config and clears it", () => {
    const {
      getPmtilesConfig,
      setPmtilesConfig,
      clearPmtilesConfig,
      REQUIRED_PMTILES_FILENAME,
    } = require("../pmtilesConfig") as typeof import("../pmtilesConfig");

    expect(getPmtilesConfig()).toBeNull();
    setPmtilesConfig({
      pmtilesPath: "file:///app-docs/maptiles/india-ne.pmtiles",
      pmtilesFileName: REQUIRED_PMTILES_FILENAME,
      pmtilesSize: 1024,
      pmtilesValidatedAt: 1_700_000_000_000,
      pmtilesHash: "abc",
    });

    expect(getPmtilesConfig()).toEqual({
      pmtilesPath: "file:///app-docs/maptiles/india-ne.pmtiles",
      pmtilesFileName: REQUIRED_PMTILES_FILENAME,
      pmtilesSize: 1024,
      pmtilesValidatedAt: 1_700_000_000_000,
      pmtilesHash: "abc",
    });

    clearPmtilesConfig();
    expect(getPmtilesConfig()).toBeNull();
  });

  it("returns null for invalid persisted payload", () => {
    store.set("pmtilesConfig.v1", JSON.stringify({ bad: true }));
    const { getPmtilesConfig } = require("../pmtilesConfig") as typeof import("../pmtilesConfig");
    expect(getPmtilesConfig()).toBeNull();
  });
});
