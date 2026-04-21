import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type LngLatBounds,
  type StyleSpecification,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";

import type { LocationPointRow } from "../db/schema";
import { getPmtilesConfig } from "../storage/pmtilesConfig";

type Props = {
  points: LocationPointRow[];
};

const DEFAULT_CENTER: [number, number] = [91.750605, 26.129195];
const FIT_PADDING = { top: 28, right: 28, bottom: 28, left: 28 };

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

export function OfflineJourneyMap({ points }: Props) {
  const lastPoint = points[points.length - 1] ?? null;
  const lineFeature = useMemo(
    () => (points.length > 1 ? toLineFeature(points) : null),
    [points],
  );
  const pointFeature = useMemo(
    () => (lastPoint ? toPointFeature(lastPoint) : null),
    [lastPoint],
  );
  const pmtilesConfig = getPmtilesConfig();
  const mapStyle = useMemo(
    () => buildOfflineStyle(pmtilesConfig?.pmtilesPath),
    [pmtilesConfig?.pmtilesPath],
  );

  const cameraRef = useRef<CameraRef>(null);
  const mapReadyRef = useRef(false);

  const initialCenter = useMemo((): [number, number] => {
    if (lastPoint) {
      return [lastPoint.lng, lastPoint.lat];
    }
    return DEFAULT_CENTER;
  }, [lastPoint]);

  const applyCameraToPoints = useCallback(() => {
    if (!mapReadyRef.current) {
      return;
    }
    const cam = cameraRef.current;
    if (!cam || points.length === 0) {
      return;
    }
    try {
      if (points.length === 1) {
        cam.easeTo({
          center: [points[0].lng, points[0].lat],
          zoom: 14,
          duration: 320,
        });
        return;
      }
      const bounds = boundsFromPoints(points);
      if (bounds) {
        cam.fitBounds(bounds, {
          padding: FIT_PADDING,
          duration: 420,
        });
      }
    } catch {
      // Camera not attached yet
    }
  }, [points]);

  useEffect(() => {
    applyCameraToPoints();
  }, [applyCameraToPoints]);

  return (
    <View className="h-64 overflow-hidden rounded-xl border border-neutral-200">
      <Map
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        dragPan
        touchZoom
        doubleTapZoom
        doubleTapHoldZoom
        onDidFinishLoadingMap={() => {
          mapReadyRef.current = true;
          applyCameraToPoints();
        }}
        onDidFinishLoadingStyle={() => {
          mapReadyRef.current = true;
          applyCameraToPoints();
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            zoom: 12,
            center: initialCenter,
          }}
          minZoom={2}
          maxZoom={22}
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
      <View className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1">
        <Text className="font-mono text-xs text-neutral-700">
          PMTiles: {pmtilesConfig?.pmtilesFileName ?? "missing"}
        </Text>
      </View>
    </View>
  );
}
