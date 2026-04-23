import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type LngLatBounds,
  type MapRef,
  type StyleSpecification,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, type NativeSyntheticEvent } from "react-native";

import type { LocationPointRow } from "../db/schema";
import { getPmtilesConfig } from "../storage/pmtilesConfig";

type Props = {
  points: LocationPointRow[];
  markerHead?: LocationPointRow | null;
  fallbackLngLat?: { lat: number; lng: number } | null;
};

const DEFAULT_CENTER: [number, number] = [91.750605, 26.129195];
const FIT_PADDING = { top: 28, right: 28, bottom: 28, left: 28 };
const MIN_ZOOM = 2;
const MAX_ZOOM = 22;
const ZOOM_STEP = 1;
const INITIAL_ZOOM = 12;
const ZOOM_ANIM_MS = 180;
/** Ignore userInteraction on region events shortly after programmatic route fits. */
const PROGRAMMATIC_FIT_SUPPRESS_MS = 550;

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

const offlineFallbackStyle: StyleSpecification = {
  version: 8,
  name: "MapMyTrip Offline Fallback",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#F3F4F6",
      },
    },
  ],
};

function buildOfflineStyle(pmtilesPath: string | undefined): StyleSpecification {
  if (!pmtilesPath) {
    return offlineFallbackStyle;
  }

  return {
    version: 8,
    name: "MapMyTrip PMTiles Basemap",
    sources: {
      "pmtiles-basemap": {
        type: "vector",
        url: `pmtiles://${pmtilesPath}`,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#F3F4F6",
        },
      },
      {
        id: "landuse-fill",
        type: "fill",
        source: "pmtiles-basemap",
        "source-layer": "landuse",
        paint: {
          "fill-color": "#E5E7EB",
        },
      },
      {
        id: "water-fill",
        type: "fill",
        source: "pmtiles-basemap",
        "source-layer": "water",
        paint: {
          "fill-color": "#BFDBFE",
        },
      },
      {
        id: "transportation-line",
        type: "line",
        source: "pmtiles-basemap",
        "source-layer": "transportation",
        paint: {
          "line-color": "#64748B",
          "line-width": 1.2,
        },
      },
      {
        id: "boundary-line",
        type: "line",
        source: "pmtiles-basemap",
        "source-layer": "boundary",
        paint: {
          "line-color": "#94A3B8",
          "line-width": 1,
          "line-dasharray": [2, 2],
        },
      },
      {
        id: "building-fill",
        type: "fill",
        source: "pmtiles-basemap",
        "source-layer": "building",
        paint: {
          "fill-color": "#D1D5DB",
          "fill-opacity": 0.8,
        },
      },
    ],
  };
}

export function OfflineJourneyMap({ points, markerHead, fallbackLngLat }: Props) {
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
  const pmtilesConfig = getPmtilesConfig();
  const mapStyle = useMemo(
    () => buildOfflineStyle(pmtilesConfig?.pmtilesPath),
    [pmtilesConfig?.pmtilesPath],
  );

  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const mapReadyRef = useRef(false);
  const ignoreUserViewportUntilRef = useRef(0);
  const userInteractionRef = useRef(false);
  const [currentZoom, setCurrentZoom] = useState(INITIAL_ZOOM);
  /** When true, new points (live or replay path) trigger auto fit. Cleared on user pan/zoom; restored by recenter. */
  const [autoFollowRoute, setAutoFollowRoute] = useState(true);

  const initialCenter = useMemo((): [number, number] => {
    if (points.length >= 1) {
      const p = points[points.length - 1]!;
      return [p.lng, p.lat];
    }
    if (markerHead !== undefined && markerHead !== null) {
      return [markerHead.lng, markerHead.lat];
    }
    if (fallbackLngLat) {
      return [fallbackLngLat.lng, fallbackLngLat.lat];
    }
    return DEFAULT_CENTER;
  }, [points, markerHead, fallbackLngLat]);

  const fitCameraToRoute = useCallback(() => {
    if (!mapReadyRef.current) {
      return;
    }
    const cam = cameraRef.current;
    if (!cam) {
      return;
    }
    ignoreUserViewportUntilRef.current = Date.now() + PROGRAMMATIC_FIT_SUPPRESS_MS;
    try {
      if (points.length >= 2) {
        const bounds = boundsFromPoints(points);
        if (bounds) {
          cam.fitBounds(bounds, {
            padding: FIT_PADDING,
            duration: 420,
          });
        }
        return;
      }
      if (points.length === 1) {
        cam.easeTo({
          center: [points[0].lng, points[0].lat],
          zoom: 14,
          duration: 320,
        });
        return;
      }
      if (markerHead !== undefined && markerHead !== null) {
        cam.easeTo({
          center: [markerHead.lng, markerHead.lat],
          zoom: 14,
          duration: 320,
        });
        return;
      }
      if (fallbackLngLat) {
        cam.easeTo({
          center: [fallbackLngLat.lng, fallbackLngLat.lat],
          zoom: 14,
          duration: 320,
        });
      }
    } catch {
      // Camera not attached yet
    }
  }, [points, markerHead, fallbackLngLat]);

  const syncZoomFromMap = useCallback(() => {
    void mapRef.current?.getZoom().then((z) => {
      if (typeof z === "number" && !Number.isNaN(z)) {
        setCurrentZoom(z);
      }
    });
  }, []);

  useEffect(() => {
    if (!autoFollowRoute) {
      return;
    }
    if (!userInteractionRef.current) {
      fitCameraToRoute();
    }
  }, [autoFollowRoute, fitCameraToRoute]);

  const onRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const { zoom: z, userInteraction } = event.nativeEvent;
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
    },
    [],
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
      try {
        cam.zoomTo(next, { duration: ZOOM_ANIM_MS });
      } catch {
        // Camera not attached yet
      }
    });
  }, []);

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
          if (autoFollowRoute && !userInteractionRef.current) {
            fitCameraToRoute();
            syncZoomFromMap();
          }
        }}
        onDidFinishLoadingStyle={() => {
          mapReadyRef.current = true;
          if (autoFollowRoute && !userInteractionRef.current) {
            fitCameraToRoute();
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
            <Layer
              id="journey-point-layer"
              type="circle"
              paint={{ "circle-color": "#DC2626", "circle-radius": 5 }}
            />
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
            setAutoFollowRoute(true);
            if (wasFollowing) {
              fitCameraToRoute();
              syncZoomFromMap();
            }
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
