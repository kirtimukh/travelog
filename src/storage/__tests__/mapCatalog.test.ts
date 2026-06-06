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

const validEntry = {
  name: "india-ne",
  pmtiles: "https://example.com/india-ne.pmtiles",
  metadata: "https://example.com/india-ne.json",
  bounds: [89.1, 24.2, 97.5, 29.9],
  minZoom: 0,
  maxZoom: 12,
  center: [93.3, 27.0, 6],
};

describe("map catalog storage", () => {
  beforeEach(() => {
    store.clear();
    mockGetString.mockClear();
    mockSet.mockClear();
    mockRemove.mockClear();
    jest.resetModules();
  });

  it("parseCatalogEntries accepts a valid entry", () => {
    const { parseCatalogEntries } = require("../mapCatalog") as typeof import("../mapCatalog");
    expect(parseCatalogEntries([validEntry])).toEqual([
      {
        name: "india-ne",
        pmtiles: "https://example.com/india-ne.pmtiles",
        metadata: "https://example.com/india-ne.json",
        bounds: [89.1, 24.2, 97.5, 29.9],
        minZoom: 0,
        maxZoom: 12,
        center: [93.3, 27.0, 6],
      },
    ]);
  });

  it("parseCatalogEntries rejects missing required fields", () => {
    const { parseCatalogEntries } = require("../mapCatalog") as typeof import("../mapCatalog");
    expect(parseCatalogEntries([{ ...validEntry, name: "" }])).toBeNull();
    expect(parseCatalogEntries([{ ...validEntry, pmtiles: "" }])).toBeNull();
    expect(parseCatalogEntries([{ ...validEntry, bounds: [1, 2, 3] }])).toBeNull();
    expect(parseCatalogEntries([{ ...validEntry, minZoom: "0" }])).toBeNull();
  });

  it("parseCatalogEntries rejects non-array input", () => {
    const { parseCatalogEntries } = require("../mapCatalog") as typeof import("../mapCatalog");
    expect(parseCatalogEntries(null)).toBeNull();
    expect(parseCatalogEntries({})).toBeNull();
  });

  it("roundtrips map catalog state through MMKV", () => {
    const {
      getMapCatalog,
      setMapCatalog,
      clearMapCatalog,
    } = require("../mapCatalog") as typeof import("../mapCatalog");

    expect(getMapCatalog()).toBeNull();
    setMapCatalog({
      entries: [
        {
          name: "india-ne",
          pmtiles: "https://example.com/india-ne.pmtiles",
          bounds: [89.1, 24.2, 97.5, 29.9],
          minZoom: 0,
          maxZoom: 12,
        },
      ],
      bundledRevision: 1,
      loadedAt: 1_700_000_000_000,
    });
    expect(getMapCatalog()).toEqual({
      entries: [
        {
          name: "india-ne",
          pmtiles: "https://example.com/india-ne.pmtiles",
          bounds: [89.1, 24.2, 97.5, 29.9],
          minZoom: 0,
          maxZoom: 12,
        },
      ],
      bundledRevision: 1,
      loadedAt: 1_700_000_000_000,
    });
    clearMapCatalog();
    expect(getMapCatalog()).toBeNull();
  });

  it("ensureMapCatalogLoaded seeds MMKV from bundled catalog", () => {
    const {
      ensureMapCatalogLoaded,
      BUNDLED_CATALOG_REVISION,
    } = require("../mapCatalog") as typeof import("../mapCatalog");

    const loaded = ensureMapCatalogLoaded();
    expect(loaded).not.toBeNull();
    expect(loaded?.bundledRevision).toBe(BUNDLED_CATALOG_REVISION);
    expect(loaded?.entries.length).toBeGreaterThan(0);
    expect(mockSet).toHaveBeenCalled();
  });

  it("ensureMapCatalogLoaded returns cached catalog when revision matches", () => {
    const {
      ensureMapCatalogLoaded,
      setMapCatalog,
      BUNDLED_CATALOG_REVISION,
    } = require("../mapCatalog") as typeof import("../mapCatalog");

    setMapCatalog({
      entries: [
        {
          name: "cached-region",
          pmtiles: "https://example.com/cached-region.pmtiles",
          bounds: [1, 2, 3, 4],
          minZoom: 0,
          maxZoom: 10,
        },
      ],
      bundledRevision: BUNDLED_CATALOG_REVISION,
      loadedAt: 1,
    });
    mockSet.mockClear();

    const loaded = ensureMapCatalogLoaded();
    expect(loaded?.entries[0]?.name).toBe("cached-region");
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("ensureMapCatalogLoaded reloads when bundled revision is stale", () => {
    const {
      ensureMapCatalogLoaded,
      setMapCatalog,
    } = require("../mapCatalog") as typeof import("../mapCatalog");

    setMapCatalog({
      entries: [
        {
          name: "stale-region",
          pmtiles: "https://example.com/stale-region.pmtiles",
          bounds: [1, 2, 3, 4],
          minZoom: 0,
          maxZoom: 10,
        },
      ],
      bundledRevision: 0,
      loadedAt: 1,
    });

    const loaded = ensureMapCatalogLoaded();
    expect(loaded?.entries.some((entry) => entry.name === "stale-region")).toBe(false);
    expect(loaded?.entries.length).toBeGreaterThan(1);
  });

  it("hasValidMapCatalog is true after bundled load", () => {
    const { hasValidMapCatalog } = require("../mapCatalog") as typeof import("../mapCatalog");
    expect(hasValidMapCatalog()).toBe(true);
  });
});

describe("getMapCatalogStatusLine", () => {
  it("returns status strings for checking, ready, and failed states", () => {
    const { getMapCatalogStatusLine } =
      require("../mapCatalog") as typeof import("../mapCatalog");
    expect(getMapCatalogStatusLine(false, true, 0)).toBe("Loading map catalog...");
    expect(getMapCatalogStatusLine(true, false, 270)).toBe(
      "Map catalog ready: 270 regions",
    );
    expect(getMapCatalogStatusLine(false, false, 0)).toBe("Map catalog unavailable.");
  });
});
