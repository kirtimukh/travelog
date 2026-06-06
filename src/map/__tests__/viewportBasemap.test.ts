import type { Bounds, CatalogEntry } from "../catalog";
import {
  applyViewportUpdate,
  createInitialBasemapState,
  finishStyleUpdate,
} from "../viewportBasemap";

function entry(name: string, bounds: Bounds): CatalogEntry {
  return {
    name,
    pmtiles: `https://example.com/${name}.pmtiles`,
    bounds,
    minZoom: 0,
    maxZoom: 14,
  };
}

const catalog = [
  entry("region-a", [0, 0, 2, 2]),
  entry("region-b", [10, 10, 12, 12]),
];

describe("applyViewportUpdate", () => {
  it("selects active regions and marks the style as updating", () => {
    const initial = createInitialBasemapState();
    const next = applyViewportUpdate(initial, catalog, {
      viewport: [0, 0, 1, 1],
      zoom: 8,
    });

    expect(next.styleUpdating).toBe(true);
    expect(Array.from(next.activeRegionKey)).toEqual(["region-a"]);
    expect(Object.keys(next.style.sources ?? {})).toEqual(["pmtiles-region-a"]);
  });

  it("returns the same state when the active region set is unchanged", () => {
    const initial = createInitialBasemapState();
    const first = applyViewportUpdate(initial, catalog, {
      viewport: [0, 0, 1, 1],
      zoom: 8,
    });
    const settled = finishStyleUpdate(first, catalog);
    const second = applyViewportUpdate(settled, catalog, {
      viewport: [0, 0, 1, 1],
      zoom: 8,
    });

    expect(second).toBe(settled);
  });

  it("rebuilds the style when the active region set changes", () => {
    const initial = createInitialBasemapState();
    const first = applyViewportUpdate(initial, catalog, {
      viewport: [0, 0, 1, 1],
      zoom: 8,
    });
    const settled = finishStyleUpdate(first, catalog);
    const second = applyViewportUpdate(settled, catalog, {
      viewport: [10, 10, 11, 11],
      zoom: 8,
    });

    expect(Array.from(second.activeRegionKey)).toEqual(["region-b"]);
    expect(Object.keys(second.style.sources ?? {})).toEqual(["pmtiles-region-b"]);
    expect(second.styleUpdating).toBe(true);
  });

  it("stores a pending viewport update while a style swap is in flight", () => {
    const initial = createInitialBasemapState();
    const updating = applyViewportUpdate(initial, catalog, {
      viewport: [0, 0, 1, 1],
      zoom: 8,
    });
    const pending = applyViewportUpdate(updating, catalog, {
      viewport: [10, 10, 11, 11],
      zoom: 8,
    });

    expect(pending.styleUpdating).toBe(true);
    expect(pending.pendingViewportUpdate).toEqual({
      viewport: [10, 10, 11, 11],
      zoom: 8,
    });
  });
});

describe("finishStyleUpdate", () => {
  it("replays a pending viewport update after the style finishes loading", () => {
    const initial = createInitialBasemapState();
    const updating = applyViewportUpdate(initial, catalog, {
      viewport: [0, 0, 1, 1],
      zoom: 8,
    });
    const withPending = applyViewportUpdate(updating, catalog, {
      viewport: [10, 10, 11, 11],
      zoom: 8,
    });
    const finished = finishStyleUpdate(withPending, catalog);

    expect(finished.styleUpdating).toBe(true);
    expect(Array.from(finished.activeRegionKey)).toEqual(["region-b"]);
    expect(finished.pendingViewportUpdate).toBeNull();
  });
});
