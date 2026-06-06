import bundledCatalog from "../../assets/catalog/catalog.json";

import type { Bounds, CatalogEntry } from "../map/catalog";

import { getAppStorage } from "./mmkv";

const MAP_CATALOG_KEY = "mapCatalog.v1";
const LEGACY_PMTILES_CONFIG_KEY = "pmtilesConfig.v1";
export const BUNDLED_CATALOG_REVISION = 1;

export type MapCatalogState = {
  entries: CatalogEntry[];
  bundledRevision: number;
  loadedAt: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseBounds(raw: unknown): Bounds | null {
  if (!Array.isArray(raw) || raw.length !== 4) {
    return null;
  }
  const [west, south, east, north] = raw;
  if (
    !isFiniteNumber(west) ||
    !isFiniteNumber(south) ||
    !isFiniteNumber(east) ||
    !isFiniteNumber(north)
  ) {
    return null;
  }
  return [west, south, east, north];
}

function parseCenter(raw: unknown): [number, number, number] | undefined {
  if (!Array.isArray(raw) || raw.length !== 3) {
    return undefined;
  }
  const [lon, lat, zoom] = raw;
  if (!isFiniteNumber(lon) || !isFiniteNumber(lat) || !isFiniteNumber(zoom)) {
    return undefined;
  }
  return [lon, lat, zoom];
}

function parseCatalogEntry(raw: unknown): CatalogEntry | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const item = raw as Record<string, unknown>;
  const bounds = parseBounds(item.bounds);
  if (
    typeof item.name !== "string" ||
    item.name.length === 0 ||
    typeof item.pmtiles !== "string" ||
    item.pmtiles.length === 0 ||
    !bounds ||
    !isFiniteNumber(item.minZoom) ||
    !isFiniteNumber(item.maxZoom)
  ) {
    return null;
  }
  const entry: CatalogEntry = {
    name: item.name,
    pmtiles: item.pmtiles,
    bounds,
    minZoom: item.minZoom,
    maxZoom: item.maxZoom,
  };
  if (typeof item.metadata === "string" && item.metadata.length > 0) {
    entry.metadata = item.metadata;
  }
  const center = parseCenter(item.center);
  if (center) {
    entry.center = center;
  }
  return entry;
}

export function parseCatalogEntries(raw: unknown): CatalogEntry[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const entries: CatalogEntry[] = [];
  for (const item of raw) {
    const parsed = parseCatalogEntry(item);
    if (!parsed) {
      return null;
    }
    entries.push(parsed);
  }
  return entries;
}

export function loadBundledCatalogEntries(): CatalogEntry[] | null {
  return parseCatalogEntries(bundledCatalog);
}

function parseMapCatalogState(raw: unknown): MapCatalogState | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const parsed = raw as Partial<MapCatalogState>;
  const entries = parseCatalogEntries(parsed.entries);
  if (
    !entries ||
    entries.length === 0 ||
    !isFiniteNumber(parsed.bundledRevision) ||
    !isFiniteNumber(parsed.loadedAt)
  ) {
    return null;
  }
  return {
    entries,
    bundledRevision: parsed.bundledRevision,
    loadedAt: parsed.loadedAt,
  };
}

export function getMapCatalog(): MapCatalogState | null {
  try {
    const raw = getAppStorage().getString(MAP_CATALOG_KEY);
    if (!raw) {
      return null;
    }
    return parseMapCatalogState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setMapCatalog(state: MapCatalogState): void {
  getAppStorage().set(MAP_CATALOG_KEY, JSON.stringify(state));
}

export function clearMapCatalog(): void {
  getAppStorage().remove(MAP_CATALOG_KEY);
}

function migrateLegacyPmtilesStorage(): void {
  getAppStorage().remove(LEGACY_PMTILES_CONFIG_KEY);
}

export function reloadBundledMapCatalog(): MapCatalogState | null {
  clearMapCatalog();
  return ensureMapCatalogLoaded();
}

export function ensureMapCatalogLoaded(): MapCatalogState | null {
  migrateLegacyPmtilesStorage();

  const cached = getMapCatalog();
  if (cached && cached.bundledRevision === BUNDLED_CATALOG_REVISION) {
    return cached;
  }

  const entries = loadBundledCatalogEntries();
  if (!entries || entries.length === 0) {
    clearMapCatalog();
    return null;
  }

  const state: MapCatalogState = {
    entries,
    bundledRevision: BUNDLED_CATALOG_REVISION,
    loadedAt: Date.now(),
  };
  setMapCatalog(state);
  return state;
}

export function hasValidMapCatalog(): boolean {
  return (ensureMapCatalogLoaded()?.entries.length ?? 0) > 0;
}

export function getMapCatalogStatusLine(
  ready: boolean,
  checking: boolean,
  regionCount: number,
): string {
  if (checking) {
    return "Loading map catalog...";
  }
  if (!ready) {
    return "Map catalog unavailable.";
  }
  return `Map catalog ready: ${regionCount} regions`;
}
