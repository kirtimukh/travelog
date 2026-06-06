import type { StyleSpecification } from "@maplibre/maplibre-react-native";

import { buildStyle, type CatalogEntry } from "./catalog";

export const SPIKE_REGION_NAME = "asia_india_southern-zone";

const LOCAL_ENTRY_NAME = "local-upload";

function localCatalogEntry(path: string): CatalogEntry {
  return {
    name: LOCAL_ENTRY_NAME,
    pmtiles: path,
    bounds: [-180, -90, 180, 90],
    minZoom: 0,
    maxZoom: 22,
  };
}

export function getSpikeBasemapEntry(
  entries: CatalogEntry[] | null | undefined,
): CatalogEntry | null {
  if (!entries) {
    return null;
  }
  return entries.find((entry) => entry.name === SPIKE_REGION_NAME) ?? null;
}

/**
 * Basemap style resolution (Phase 2 spike):
 * 1. S3 spike region from bundled catalog
 * 2. Local dev fallback from uploaded .pmtiles path
 * 3. Gray background-only fallback
 */
export function resolveBasemapStyle(options: {
  catalogEntries: CatalogEntry[] | null | undefined;
  localPmtilesPath?: string | null;
}): StyleSpecification {
  const spikeEntry = getSpikeBasemapEntry(options.catalogEntries);
  if (spikeEntry) {
    return buildStyle([spikeEntry]);
  }

  const localPath = options.localPmtilesPath;
  if (localPath) {
    return buildStyle([localCatalogEntry(localPath)]);
  }

  return buildStyle([]);
}
