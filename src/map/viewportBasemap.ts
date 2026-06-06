import type { StyleSpecification } from "@maplibre/maplibre-react-native";

import {
  buildStyle,
  regionsForViewport,
  regionSetsEqual,
  type Bounds,
  type CatalogEntry,
} from "./catalog";

export type ViewportUpdate = {
  viewport: Bounds;
  zoom: number;
};

export type ViewportBasemapState = {
  activeRegionKey: Set<string>;
  style: StyleSpecification;
  styleUpdating: boolean;
  pendingViewportUpdate: ViewportUpdate | null;
};

function regionSetFromEntries(entries: CatalogEntry[]): Set<string> {
  return new Set(entries.map((entry) => entry.name));
}

export function createInitialBasemapState(): ViewportBasemapState {
  return {
    activeRegionKey: new Set(),
    style: buildStyle([]),
    styleUpdating: false,
    pendingViewportUpdate: null,
  };
}

export function applyViewportUpdate(
  state: ViewportBasemapState,
  catalog: CatalogEntry[],
  update: ViewportUpdate,
): ViewportBasemapState {
  if (state.styleUpdating) {
    return {
      ...state,
      pendingViewportUpdate: update,
    };
  }

  const regions = regionsForViewport(catalog, update.viewport, update.zoom);
  const nextKey = regionSetFromEntries(regions);
  if (regionSetsEqual(state.activeRegionKey, nextKey)) {
    return state;
  }

  return {
    activeRegionKey: nextKey,
    style: buildStyle(regions),
    styleUpdating: true,
    pendingViewportUpdate: null,
  };
}

export function finishStyleUpdate(
  state: ViewportBasemapState,
  catalog: CatalogEntry[],
): ViewportBasemapState {
  const cleared: ViewportBasemapState = {
    ...state,
    styleUpdating: false,
  };
  const pending = cleared.pendingViewportUpdate;
  if (!pending) {
    return cleared;
  }

  return applyViewportUpdate(
    { ...cleared, pendingViewportUpdate: null },
    catalog,
    pending,
  );
}
