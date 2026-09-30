import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type LngLatBounds,
  type MapRef,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, type NativeSyntheticEvent } from "react-native";

import type { LocationPointRow } from "../db/schema";
import { ensureMapCatalogLoaded } from "../storage/mapCatalog";
import { useViewportBasemapStyle } from "./useViewportBasemapStyle";

type Props = {
  points: LocationPointRow[];
  markerHead?: LocationPointRow | null;
  fallbackLngLat?: { lat: number; lng: number } | null;
  fallbackMarkerVariant?: "default" | "scheduledCurrentLocation";
};

const DEFAULT_CENTER: [number, number] = [91.750605, 26.129195];
const FIT_PADDING = { top: 28, right: 28, bottom: 28, left: 28 };
const MIN_ZOOM = 6;
const MAX_ZOOM = 22;
const ZOOM_STEP = 1;
const AUTO_CENTER_ZOOM = 13;
const INITIAL_ZOOM = AUTO_CENTER_ZOOM;
const ZOOM_ANIM_MS = 180;
/** Ignore userInteraction on region events shortly after programmatic route fits. */
const PROGRAMMATIC_FIT_SUPPRESS_MS = 550;

type FollowMode = "autoCenter" | "fitBounds";

function toLineFeature(points: LocationPointRow[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: points.map((p) => [p.lng, p.lat]),
    },
  };
}

function toPointFeature(point: LocationPointRow) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Point" as const,
      coordinates: [point.lng, point.lat],
    },
  };
}

function boundsFromPoints(points: LocationPointRow[]): LngLatBounds | null {
  if (points.length === 0) {
    return null;
  }
  let west = points[0].lng;
  let east = points[0].lng;
  let south = points[0].lat;
  let north = points[0].lat;
  for (const p of points) {
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  const pad = 0.00015;
  if (east - west < pad) {
    west -= pad;
    east += pad;
  }
  if (north - south < pad) {
    south -= pad;
    north += pad;
  }
  return [west, south, east, north];
}

function isLngLatBounds(value: unknown): value is LngLatBounds {
  if (!Array.isArray(value) || value.length !== 4) {
    return false;
  }
  return value.every((n) => typeof n === "number" && Number.isFinite(n));
}

export function OfflineJourneyMap({
  points,
  markerHead,
  fallbackLngLat,
  fallbackMarkerVariant = "default",
}: Props) {
  const lastPathPoint = points[points.length - 1] ?? null;
  const lineFeature = useMemo(
    () => (points.length > 1 ? toLineFeature(points) : null),
    [points],
  );
  const resolvedMarkerPoint = useMemo((): LocationPointRow | null => {
    if (markerHead !== undefined) {
      return markerHead;
    }
    if (lastPathPoint) {
      return lastPathPoint;
    }
    if (fallbackLngLat) {
      return {
        id: -1,
        journey_id: -1,
        lat: fallbackLngLat.lat,
        lng: fallbackLngLat.lng,
        timestamp: 0,
        metadata: null,
        speed: null,
        heading: null,
      };
    }
    return null;
  }, [markerHead, lastPathPoint, fallbackLngLat]);
  const pointFeature = useMemo(
    () => (resolvedMarkerPoint ? toPointFeature(resolvedMarkerPoint) : null),
    [resolvedMarkerPoint],
  );
  const catalogState = ensureMapCatalogLoaded();
  const { mapStyle, onViewportChange, onStyleDidFinishLoading } =
    useViewportBasemapStyle(catalogState?.entries);

  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const mapReadyRef = useRef(false);
  const ignoreUserViewportUntilRef = useRef(0);
  const userInteractionRef = useRef(false);
  /** Set by recenter before inline applyFollowCamera; effect skips one run to avoid double animation. */
  const skipNextFollowEffectRef = useRef(false);
  const [currentZoom, setCurrentZoom] = useState(INITIAL_ZOOM);
  /** When true, new points (live or replay) re-apply the active follow mode. Cleared on user pan/zoom or +/- buttons; restored by recenter. */
  const [autoFollowRoute, setAutoFollowRoute] = useState(true);
  /** autoCenter: red marker @ zoom 13. fitBounds: full route when points.length >= 2. Toggled by recenter while following. */
  const [followMode, setFollowMode] = useState<FollowMode>("autoCenter");

  const markUserMapInteraction = useCallback(() => {
    userInteractionRef.current = true;
    setAutoFollowRoute(false);
  }, []);

  const initialCenter = useMemo((): [number, number] => {
    if (resolvedMarkerPoint) {
      return [resolvedMarkerPoint.lng, resolvedMarkerPoint.lat];
    }
    return DEFAULT_CENTER;
  }, [resolvedMarkerPoint]);

  const scheduleViewportUpdate = useCallback(
    (bounds: LngLatBounds, zoom: number) => {
      onViewportChange(bounds, zoom);
    },
    [onViewportChange],
  );

  const syncViewportFromMap = useCallback(() => {
    void mapRef.current?.getViewState().then((viewState) => {
      if (isLngLatBounds(viewState.bounds)) {
        scheduleViewportUpdate(viewState.bounds, viewState.zoom);
      }
    });
  }, [scheduleViewportUpdate]);

  const applyFollowCamera = useCallback(
    (mode: FollowMode = followMode) => {
      if (!mapReadyRef.current) {
        return;
      }
      const cam = cameraRef.current;
      if (!cam) {
        return;
      }
      ignoreUserViewportUntilRef.current =
        Date.now() + PROGRAMMATIC_FIT_SUPPRESS_MS;
      try {
        if (mode === "fitBounds" && points.length >= 2) {
          const bounds = boundsFromPoints(points);
          if (bounds) {
            cam.fitBounds(bounds, {
              padding: FIT_PADDING,
              duration: 420,
            });
          }
          return;
        }
        if (resolvedMarkerPoint) {
          cam.easeTo({
            center: [resolvedMarkerPoint.lng, resolvedMarkerPoint.lat],
            zoom: AUTO_CENTER_ZOOM,
            duration: 320,
          });
        }
      } catch {
        // Camera not attached yet
      }
    },
    [followMode, points, resolvedMarkerPoint],
  );

  const syncZoomFromMap = useCallback(() => {
    void mapRef.current?.getZoom().then((z) => {
      if (typeof z === "number" && !Number.isNaN(z)) {
        setCurrentZoom(z);
      }
    });
  }, []);

  useEffect(() => {
    if (skipNextFollowEffectRef.current) {
      skipNextFollowEffectRef.current = false;
      return;
    }
    if (!autoFollowRoute || userInteractionRef.current) {
      return;
    }
    applyFollowCamera();
  }, [autoFollowRoute, followMode, points, resolvedMarkerPoint, applyFollowCamera]);

  const onRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const { bounds, zoom: z, userInteraction } = event.nativeEvent;
      if (typeof z === "number" && !Number.isNaN(z)) {
        setCurrentZoom(z);
      }
      userInteractionRef.current = userInteraction;
      if (
        userInteraction &&
        Date.now() > ignoreUserViewportUntilRef.current
      ) {
        setAutoFollowRoute(false);
      }
      if (isLngLatBounds(bounds) && typeof z === "number" && !Number.isNaN(z)) {
        scheduleViewportUpdate(bounds, z);
      }
    },
    [scheduleViewportUpdate],
  );

  const zoomByStep = useCallback((delta: number) => {
    const cam = cameraRef.current;
    const map = mapRef.current;
    if (!cam || !map) {
      return;
    }
    void map.getZoom().then((z) => {
      if (typeof z !== "number" || Number.isNaN(z)) {
        return;
      }
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta));
      if (Math.abs(next - z) < 1e-6) {
        return;
      }
      markUserMapInteraction();
      try {
        cam.zoomTo(next, { duration: ZOOM_ANIM_MS });
      } catch {
        // Camera not attached yet
      }
    });
  }, [markUserMapInteraction]);

  const canZoomIn = currentZoom < MAX_ZOOM - 1e-3;
  const canZoomOut = currentZoom > MIN_ZOOM + 1e-3;

  return (
    <View className="h-64 overflow-hidden rounded-xl border border-neutral-200">
      <Map
        ref={mapRef}
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        dragPan
        touchZoom
        doubleTapZoom
        doubleTapHoldZoom
        onRegionDidChange={onRegionDidChange}
        onDidFinishLoadingMap={() => {
          mapReadyRef.current = true;
          syncViewportFromMap();
          if (autoFollowRoute && !userInteractionRef.current) {
            applyFollowCamera();
            syncZoomFromMap();
          }
        }}
        onDidFinishLoadingStyle={() => {
          onStyleDidFinishLoading();
          mapReadyRef.current = true;
          if (autoFollowRoute && !userInteractionRef.current) {
            applyFollowCamera();
            syncZoomFromMap();
          }
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            zoom: INITIAL_ZOOM,
            center: initialCenter,
          }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        />
        {lineFeature ? (
          <GeoJSONSource id="journey-line" data={lineFeature}>
            <Layer
              id="journey-line-layer"
              type="line"
              paint={{ "line-color": "#1D4ED8", "line-width": 3 }}
            />
          </GeoJSONSource>
        ) : null}
        {pointFeature ? (
          <GeoJSONSource id="journey-point" data={pointFeature}>
            {fallbackMarkerVariant === "scheduledCurrentLocation" &&
            points.length === 0 &&
            markerHead == null ? (
              <>
                <Layer
                  id="journey-point-layer-outer"
                  type="circle"
                  paint={{ "circle-color": "#FFFFFF", "circle-radius": 8 }}
                />
                <Layer
                  id="journey-point-layer-inner"
                  type="circle"
                  paint={{ "circle-color": "#374151", "circle-radius": 4.5 }}
                />
              </>
            ) : (
              <Layer
                id="journey-point-layer"
                type="circle"
                paint={{ "circle-color": "#DC2626", "circle-radius": 5 }}
              />
            )}
          </GeoJSONSource>
        ) : null}
      </Map>
      <View className="absolute right-2 top-2 gap-2">
        <Pressable
          accessibilityLabel="Zoom in"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canZoomIn }}
          className={`min-h-11 min-w-11 items-center justify-center rounded-lg border border-neutral-200 bg-white/90 ${!canZoomIn ? "opacity-40" : ""}`}
          disabled={!canZoomIn}
          onPress={() => {
            zoomByStep(ZOOM_STEP);
          }}
        >
          <Text className="text-lg font-semibold text-neutral-800">+</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Zoom out"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canZoomOut }}
          className={`min-h-11 min-w-11 items-center justify-center rounded-lg border border-neutral-200 bg-white/90 ${!canZoomOut ? "opacity-40" : ""}`}
          disabled={!canZoomOut}
          onPress={() => {
            zoomByStep(-ZOOM_STEP);
          }}
        >
          <Text className="text-lg font-semibold text-neutral-800">−</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Recenter map on route"
          accessibilityRole="button"
          accessibilityState={{ disabled: points.length < 1 }}
          className={`min-h-11 min-w-11 items-center justify-center rounded-lg border border-neutral-200 bg-white/90 ${
            points.length < 1 &&
            !(markerHead !== undefined && markerHead !== null) &&
            !fallbackLngLat
              ? "opacity-40"
              : ""
          }`}
          disabled={
            points.length < 1 &&
            !(markerHead !== undefined && markerHead !== null) &&
            !fallbackLngLat
          }
          onPress={() => {
            const wasFollowing = autoFollowRoute;
            const nextMode: FollowMode = wasFollowing
              ? followMode === "autoCenter"
                ? "fitBounds"
                : "autoCenter"
              : followMode;
            if (wasFollowing) {
              setFollowMode(nextMode);
            } else {
              userInteractionRef.current = false;
            }
            skipNextFollowEffectRef.current = true;
            setAutoFollowRoute(true);
            applyFollowCamera(nextMode);
            syncZoomFromMap();
          }}
        >
          <Text className="text-lg text-neutral-800" importantForAccessibility="no">
            ⌖
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
