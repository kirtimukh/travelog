import type { Bounds, CatalogEntry } from "../catalog";
import {
  activeRegions,
  basemapLayers,
  boundsIntersect,
  buildStyle,
  buildStyleForViewport,
  lonLatToTile,
  padBounds,
  regionSetKey,
  regionSetsEqual,
  regionsForViewport,
  tilesForBounds,
} from "../catalog";

function entry(
  name: string,
  bounds: Bounds,
  minZoom = 0,
  maxZoom = 14,
): CatalogEntry {
  return {
    name,
    pmtiles: `https://example.com/${name}.pmtiles`,
    bounds,
    minZoom,
    maxZoom,
  };
}

describe("boundsIntersect", () => {
  it("returns true when viewports overlap", () => {
    expect(boundsIntersect([0, 0, 10, 10], [5, 5, 15, 15])).toBe(true);
  });

  it("returns false when viewports are disjoint", () => {
    expect(boundsIntersect([0, 0, 1, 1], [2, 2, 3, 3])).toBe(false);
  });

  it("returns true when viewports touch on an edge", () => {
    expect(boundsIntersect([0, 0, 1, 1], [1, 0, 2, 1])).toBe(true);
  });
});

describe("padBounds", () => {
  it("expands bounds by the pad fraction", () => {
    expect(padBounds([0, 0, 10, 10], 0.1)).toEqual([-1, -1, 11, 11]);
  });
});

describe("activeRegions", () => {
  const catalog = [
    entry("inside", [1, 1, 3, 3]),
    entry("outside", [20, 20, 22, 22]),
    entry("zoom-limited", [1, 1, 3, 3], 10, 12),
  ];

  it("returns entries that intersect the viewport at the given zoom", () => {
    const viewport: Bounds = [0, 0, 5, 5];
    expect(activeRegions(catalog, viewport, 11).map((r) => r.name)).toEqual([
      "inside",
      "zoom-limited",
    ]);
  });

  it("excludes entries outside zoom range", () => {
    const viewport: Bounds = [0, 0, 5, 5];
    expect(activeRegions(catalog, viewport, 9).map((r) => r.name)).toEqual([
      "inside",
    ]);
  });

  it("floors fractional zoom before filtering", () => {
    const viewport: Bounds = [0, 0, 5, 5];
    expect(activeRegions(catalog, viewport, 9.9).map((r) => r.name)).toEqual([
      "inside",
    ]);
  });
});

describe("lonLatToTile", () => {
  it("maps a known coordinate at z8", () => {
    expect(lonLatToTile(0, 0, 8)).toEqual({ x: 128, y: 128 });
  });
});

describe("tilesForBounds", () => {
  it("returns the tile grid for a small bounds box", () => {
    const tiles = tilesForBounds([0, 0, 0.5, 0.5], 8);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.z === 8)).toBe(true);
  });
});

describe("basemapLayers", () => {
  it("returns five layers with unique ids and expected source-layers", () => {
    const layers = basemapLayers("pmtiles-test");
    expect(layers).toHaveLength(5);
    expect(layers?.map((l) => l.id)).toEqual([
      "pmtiles-test-landuse",
      "pmtiles-test-water",
      "pmtiles-test-transportation",
      "pmtiles-test-boundary",
      "pmtiles-test-building",
    ]);
    expect(layers?.map((l) => ("source-layer" in l ? l["source-layer"] : null))).toEqual([
      "landuse",
      "water",
      "transportation",
      "boundary",
      "building",
    ]);
  });

  it("uses OfflineJourneyMap landuse paint", () => {
    const layers = basemapLayers("pmtiles-test");
    const landuse = layers?.find((l) => l.id === "pmtiles-test-landuse");
    expect(landuse).toMatchObject({
      paint: { "fill-color": "#E5E7EB" },
    });
  });
});

describe("regionSetKey", () => {
  it("returns sorted region names joined by pipe", () => {
    expect(
      regionSetKey([
        entry("b", [0, 0, 1, 1]),
        entry("a", [1, 1, 2, 2]),
      ]),
    ).toBe("a|b");
  });
});

describe("regionSetsEqual", () => {
  it("returns true for identical sets", () => {
    expect(regionSetsEqual(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
  });

  it("returns false when sizes differ", () => {
    expect(regionSetsEqual(new Set(["a"]), new Set(["a", "b"]))).toBe(false);
  });
});

describe("regionsForViewport", () => {
  const catalog = [
    entry("inside", [1, 1, 3, 3]),
    entry("outside", [20, 20, 22, 22]),
  ];

  it("pads the viewport before selecting active regions", () => {
    const viewport: Bounds = [0, 0, 1.05, 1.05];
    expect(regionsForViewport(catalog, viewport, 8).map((r) => r.name)).toEqual([
      "inside",
    ]);
  });
});

describe("buildStyleForViewport", () => {
  it("builds one source per active region in the viewport", () => {
    const catalog = [
      entry("inside", [1, 1, 3, 3]),
      entry("outside", [20, 20, 22, 22]),
    ];
    const style = buildStyleForViewport(catalog, [0, 0, 5, 5], 8);
    expect(Object.keys(style.sources ?? {})).toEqual(["pmtiles-inside"]);
    expect(style.layers).toHaveLength(6);
  });
});

describe("buildStyle", () => {
  it("returns background-only style for empty entries", () => {
    const style = buildStyle([]);
    expect(style.version).toBe(8);
    expect(style.name).toBe("Travelog PMTiles Basemap");
    expect(style.sources).toEqual({});
    expect(style.layers).toHaveLength(1);
    expect(style.layers?.[0].id).toBe("background");
  });

  it("builds one source and basemap layers for a single entry", () => {
    const style = buildStyle([entry("india-ne", [89, 24, 97, 29])]);
    expect(Object.keys(style.sources ?? {})).toEqual(["pmtiles-india-ne"]);
    expect(style.sources?.["pmtiles-india-ne"]).toEqual({
      type: "vector",
      url: "pmtiles://https://example.com/india-ne.pmtiles",
    });
    expect(style.layers).toHaveLength(6);
  });

  it("uses unique layer ids across multiple sources", () => {
    const style = buildStyle([
      entry("region-a", [0, 0, 1, 1]),
      entry("region-b", [1, 1, 2, 2]),
    ]);
    const ids = style.layers?.map((l) => l.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(style.sources ?? {})).toEqual([
      "pmtiles-region-a",
      "pmtiles-region-b",
    ]);
  });
});
