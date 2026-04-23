import { Image, Text, View } from "react-native";

import type { WeatherRow } from "../../../db/schema";

/** Feed + modal preview fields (matches `WeatherRow` display subset). */
export type JourneyWeatherCardDisplay = {
  timestamp: number;
  lat: number;
  lng: number;
  weather_condition: string | null;
  weather_condition_icon: string | null;
  temperature: number | null;
  feels_like_temperature: number | null;
};

function formatListTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatLatLngPair(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function weatherRowToCardDisplay(row: WeatherRow): JourneyWeatherCardDisplay {
  return {
    timestamp: row.timestamp,
    lat: row.lat,
    lng: row.lng,
    weather_condition: row.weather_condition,
    weather_condition_icon: row.weather_condition_icon,
    temperature: row.temperature,
    feels_like_temperature: row.feels_like_temperature,
  };
}

type Props = {
  data: JourneyWeatherCardDisplay;
  /** When false, omits outer `mt-3` so the modal can control spacing. */
  includeTopMargin?: boolean;
  layout?: "standalone" | "feed";
};

export function JourneyWeatherCardBody({
  data,
  includeTopMargin = true,
  layout = "standalone",
}: Props) {
  const marginClass = includeTopMargin ? "mt-3 " : "";
  const shellClass =
    layout === "feed"
      ? `${marginClass}overflow-hidden bg-sky-50`
      : `${marginClass}overflow-hidden rounded-md border border-sky-200 bg-sky-50`;
  return (
    <View className={shellClass}>
      <View className="border-b border-sky-200 px-3 py-2">
        <Text className="text-xs text-neutral-600">
          {formatListTimestamp(data.timestamp)} · ({formatLatLngPair(data.lat, data.lng)})
        </Text>
      </View>
      <View className="flex-row items-center px-3 py-3">
        {data.weather_condition_icon ? (
          <Image
            source={{ uri: data.weather_condition_icon }}
            style={{ width: 40, height: 40 }}
            resizeMode="contain"
            pointerEvents="none"
          />
        ) : null}
        <View className="ml-3 flex-1">
          <Text className="text-sm font-semibold text-neutral-900">
            {data.weather_condition ?? "Weather update"}
          </Text>
          <Text className="mt-1 text-sm text-neutral-700">
            Temperature: {data.temperature != null ? `${data.temperature}°` : "—"}
          </Text>
          <Text className="text-sm text-neutral-700">
            Feels like:{" "}
            {data.feels_like_temperature != null ? `${data.feels_like_temperature}°` : "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}
