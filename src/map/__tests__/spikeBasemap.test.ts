import type { CatalogEntry } from "../catalog";
import {
  SPIKE_REGION_NAME,
  getSpikeBasemapEntry,
  resolveBasemapStyle,
} from "../spikeBasemap";

const spikeEntry: CatalogEntry = {
  name: SPIKE_REGION_NAME,
  pmtiles:
    "https://travelog-pmtiles-575766771522-ap-south-1-an.s3.ap-south-1.amazonaws.com/tiles/asia_india_southern-zone.pmtiles",
  bounds: [70.004872, 5.943921, 95.55906, 19.9226809],
  minZoom: 0,
  maxZoom: 12,
  center: [82.781966, 12.9333009, 6],
};

const otherEntry: CatalogEntry = {
  name: "africa_kenya",
  pmtiles: "https://example.com/africa_kenya.pmtiles",
  bounds: [33, -5, 42, 5],
  minZoom: 0,
  maxZoom: 12,
};

describe("getSpikeBasemapEntry", () => {
  it("returns the spike entry when present in catalog", () => {
    expect(getSpikeBasemapEntry([otherEntry, spikeEntry])).toEqual(spikeEntry);
  });

  it("returns null when spike entry is missing", () => {
    expect(getSpikeBasemapEntry([otherEntry])).toBeNull();
    expect(getSpikeBasemapEntry(null)).toBeNull();
    expect(getSpikeBasemapEntry(undefined)).toBeNull();
  });
});

describe("resolveBasemapStyle", () => {
  it("uses the S3 spike region when catalog contains it", () => {
    const style = resolveBasemapStyle({
      catalogEntries: [spikeEntry],
      localPmtilesPath: "/data/user/0/com.example/files/map.pmtiles",
    });

    expect(Object.keys(style.sources ?? {})).toEqual([
      "pmtiles-asia_india_southern-zone",
    ]);
    expect(style.sources?.["pmtiles-asia_india_southern-zone"]).toEqual({
      type: "vector",
      url: `pmtiles://${spikeEntry.pmtiles}`,
    });
    expect(style.layers).toHaveLength(6);
  });

  it("falls back to local path when spike entry is missing", () => {
    const localPath = "file:///data/user/0/com.example/files/map.pmtiles";
    const style = resolveBasemapStyle({
      catalogEntries: [otherEntry],
      localPmtilesPath: localPath,
    });

    expect(Object.keys(style.sources ?? {})).toEqual(["pmtiles-local-upload"]);
    expect(style.sources?.["pmtiles-local-upload"]).toEqual({
      type: "vector",
      url: `pmtiles://${localPath}`,
    });
    expect(style.layers).toHaveLength(6);
  });

  it("returns background-only style when spike and local path are unavailable", () => {
    const style = resolveBasemapStyle({
      catalogEntries: [otherEntry],
      localPmtilesPath: null,
    });

    expect(style.sources).toEqual({});
    expect(style.layers).toHaveLength(1);
    expect(style.layers?.[0].id).toBe("background");
  });
});
