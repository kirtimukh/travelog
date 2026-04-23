import type { CurrentConditionsResponse, UnitsSystem } from "./types";

const GOOGLE_WEATHER_BASE_URL =
  "https://weather.googleapis.com/v1/currentConditions:lookup";

const GOOGLE_WEATHER_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_WEATHER_API_KEY;

export interface LookupCurrentConditionsParams {
  apiKey: string;
  latitude: number;
  longitude: number;
  unitsSystem?: UnitsSystem;
  languageCode?: string;
  signal?: AbortSignal;
}

function assertCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Latitude and longitude must be finite numbers.");
  }
}

export async function lookupCurrentConditions({
  apiKey,
  latitude,
  longitude,
  unitsSystem = "METRIC",
  languageCode,
  signal,
}: LookupCurrentConditionsParams): Promise<CurrentConditionsResponse> {
  if (!apiKey.trim()) {
    throw new Error("Google Weather API key is required.");
  }

  assertCoordinates(latitude, longitude);

  const params = new URLSearchParams({
    key: apiKey,
    "location.latitude": String(latitude),
    "location.longitude": String(longitude),
    unitsSystem,
  });

  if (languageCode) {
    params.set("languageCode", languageCode);
  }

  const response = await fetch(`${GOOGLE_WEATHER_BASE_URL}?${params.toString()}`, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Google Weather API request failed (${response.status} ${response.statusText}): ${body}`,
    );
  }

  return (await response.json()) as CurrentConditionsResponse;
}
