import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Bounds, CatalogEntry } from "./catalog";
import {
  applyViewportUpdate,
  createInitialBasemapState,
  finishStyleUpdate,
  type ViewportBasemapState,
} from "./viewportBasemap";

const VIEWPORT_DEBOUNCE_MS = 400;

export function useViewportBasemapStyle(
  catalogEntries: CatalogEntry[] | undefined,
): {
  mapStyle: StyleSpecification;
  onViewportChange: (viewport: Bounds, zoom: number) => void;
  onStyleDidFinishLoading: () => void;
} {
  const catalogRef = useRef<CatalogEntry[]>(catalogEntries ?? []);
  catalogRef.current = catalogEntries ?? [];

  const [state, setState] = useState<ViewportBasemapState>(createInitialBasemapState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const commitState = useCallback((next: ViewportBasemapState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const onViewportChange = useCallback(
    (viewport: Bounds, zoom: number) => {
      if (stateRef.current.styleUpdating) {
        const next = applyViewportUpdate(stateRef.current, catalogRef.current, {
          viewport,
          zoom,
        });
        if (next !== stateRef.current) {
          commitState(next);
        }
        return;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const next = applyViewportUpdate(stateRef.current, catalogRef.current, {
          viewport,
          zoom,
        });
        if (next !== stateRef.current) {
          commitState(next);
        }
      }, VIEWPORT_DEBOUNCE_MS);
    },
    [commitState],
  );

  const onStyleDidFinishLoading = useCallback(() => {
    const next = finishStyleUpdate(stateRef.current, catalogRef.current);
    if (next !== stateRef.current) {
      commitState(next);
    }
  }, [commitState]);

  return {
    mapStyle: state.style,
    onViewportChange,
    onStyleDidFinishLoading,
  };
}
