import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type StyleSpecification,
} from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { Text, View } from "react-native";

import type { LocationPointRow } from "../db/schema";
import { getPmtilesConfig } from "../storage/pmtilesConfig";

type Props = {
  points: LocationPointRow[];
};

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

  return (
    <View className="h-64 overflow-hidden rounded-xl border border-neutral-200">
      <Map style={{ flex: 1 }} mapStyle={mapStyle}>
        <Camera
          initialViewState={{
            zoom: 12,
            center: lastPoint ? [lastPoint.lng, lastPoint.lat] : [91.750605, 26.129195],
          }}
        />
        {lineFeature ? (
          <GeoJSONSource id="journey-line" data={lineFeature}>
            <Layer
              id="journey-line-layer"
              type="line"
              style={{ lineColor: "#1D4ED8", lineWidth: 3 }}
            />
          </GeoJSONSource>
        ) : null}
        {pointFeature ? (
          <GeoJSONSource id="journey-point" data={pointFeature}>
            <Layer
              id="journey-point-layer"
              type="circle"
              style={{ circleColor: "#DC2626", circleRadius: 5 }}
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
