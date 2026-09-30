import type { StyleSpecification } from "@maplibre/maplibre-react-native";

export type Bounds = [west: number, south: number, east: number, north: number];

export type CatalogEntry = {
  name: string;
  pmtiles: string;
  metadata?: string;
  bounds: Bounds;
  minZoom: number;
  maxZoom: number;
  center?: [number, number, number];
};

export type TileCoord = { z: number; x: number; y: number };

export function boundsIntersect(view: Bounds, region: Bounds): boolean {
  const [vw, vs, ve, vn] = view;
  const [rw, rs, re, rn] = region;
  if (ve < rw || vw > re) return false;
  if (vn < rs || vs > rn) return false;
  return true;
}

export function padBounds(bounds: Bounds, padFraction = 0.1): Bounds {
  const [w, s, e, n] = bounds;
  const lonPad = (e - w) * padFraction;
  const latPad = (n - s) * padFraction;
  return [w - lonPad, s - latPad, e + lonPad, n + latPad];
}

export function activeRegions(
  catalog: CatalogEntry[],
  viewport: Bounds,
  zoom: number,
): CatalogEntry[] {
  const z = Math.floor(zoom);
  return catalog.filter(
    (entry) =>
      boundsIntersect(viewport, entry.bounds) && z >= entry.minZoom,
  );
}

export function lonLatToTile(
  lon: number,
  lat: number,
  z: number,
): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}

export function tilesForBounds(bounds: Bounds, z: number): TileCoord[] {
  const [west, south, east, north] = bounds;
  const nw = lonLatToTile(west, north, z);
  const se = lonLatToTile(east, south, z);
  const tiles: TileCoord[] = [];
  for (let x = nw.x; x <= se.x; x++) {
    for (let y = nw.y; y <= se.y; y++) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
}

export function basemapLayers(sourceId: string): StyleSpecification["layers"] {
  return [
    {
      id: `${sourceId}-landuse`,
      type: "fill",
      source: sourceId,
      "source-layer": "landuse",
      paint: { "fill-color": "#E5E7EB" },
    },
    {
      id: `${sourceId}-water`,
      type: "fill",
      source: sourceId,
      "source-layer": "water",
      paint: { "fill-color": "#BFDBFE" },
    },
    {
      id: `${sourceId}-transportation`,
      type: "line",
      source: sourceId,
      "source-layer": "transportation",
      paint: { "line-color": "#64748B", "line-width": 1.2 },
    },
    {
      id: `${sourceId}-boundary`,
      type: "line",
      source: sourceId,
      "source-layer": "boundary",
      paint: {
        "line-color": "#94A3B8",
        "line-width": 1,
        "line-dasharray": [2, 2],
      },
    },
    {
      id: `${sourceId}-building`,
      type: "fill",
      source: sourceId,
      "source-layer": "building",
      paint: {
        "fill-color": "#D1D5DB",
        "fill-opacity": 0.8,
      },
    },
  ];
}

export function regionSetKey(entries: CatalogEntry[]): string {
  return entries
    .map((entry) => entry.name)
    .sort()
    .join("|");
}

export function regionSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
}

export function regionsForViewport(
  catalog: CatalogEntry[],
  viewport: Bounds,
  zoom: number,
  padFraction = 0.1,
): CatalogEntry[] {
  return activeRegions(catalog, padBounds(viewport, padFraction), zoom);
}

export function buildStyleForViewport(
  catalog: CatalogEntry[],
  viewport: Bounds,
  zoom: number,
): StyleSpecification {
  return buildStyle(regionsForViewport(catalog, viewport, zoom));
}

export function buildStyle(entries: CatalogEntry[]): StyleSpecification {
  const sources: StyleSpecification["sources"] = {};
  const layers: StyleSpecification["layers"] = [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#F3F4F6" },
    },
  ];

  for (const entry of entries) {
    const sourceId = `pmtiles-${entry.name}`;
    sources[sourceId] = {
      type: "vector",
      url: `pmtiles://${entry.pmtiles}`,
      maxzoom: entry.maxZoom,
    };
    layers.push(...basemapLayers(sourceId));
  }

  return {
    version: 8,
    name: "Travelog PMTiles Basemap",
    sources,
    layers,
  };
}
