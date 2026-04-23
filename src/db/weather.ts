import type * as SQLite from "expo-sqlite";

import type { WeatherRow } from "./schema";

export async function createWeather(
  db: SQLite.SQLiteDatabase,
  input: {
    journeyId: number;
    temperature: number | null;
    feelsLikeTemperature: number | null;
    weatherCondition: string | null;
    weatherConditionIcon: string | null;
    fullData: string;
    timestamp: number;
    lat: number;
    lng: number;
  },
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO weather (
      journey_id,
      temperature,
      feels_like_temperature,
      weather_condition,
      weather_condition_icon,
      full_data,
      timestamp,
      lat,
      lng
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.journeyId,
      input.temperature,
      input.feelsLikeTemperature,
      input.weatherCondition,
      input.weatherConditionIcon,
      input.fullData,
      input.timestamp,
      input.lat,
      input.lng,
    ],
  );
  return Number(result.lastInsertRowId);
}

export async function insertWeatherQuotaEvent(
  db: SQLite.SQLiteDatabase,
  timestamp: number,
): Promise<void> {
  await db.runAsync(`INSERT INTO weather_quota_event (timestamp) VALUES (?)`, [timestamp]);
}

export async function listRecentWeatherQuotaEventTimestamps(
  db: SQLite.SQLiteDatabase,
  minTimestamp: number,
): Promise<number[]> {
  const rows = await db.getAllAsync<{ timestamp: number }>(
    `SELECT timestamp
    FROM weather_quota_event
    WHERE timestamp >= ?
    ORDER BY timestamp DESC`,
    [minTimestamp],
  );
  return rows.map((row) => row.timestamp);
}

export async function deleteWeatherById(
  db: SQLite.SQLiteDatabase,
  journeyId: number,
  id: number,
): Promise<void> {
  await db.runAsync(`DELETE FROM weather WHERE id = ? AND journey_id = ?`, [id, journeyId]);
}

export async function listWeatherForJourney(
  db: SQLite.SQLiteDatabase,
  journeyId: number,
): Promise<WeatherRow[]> {
  return db.getAllAsync<WeatherRow>(
    `SELECT
      id,
      journey_id,
      temperature,
      feels_like_temperature,
      weather_condition,
      weather_condition_icon,
      full_data,
      timestamp,
      lat,
      lng
    FROM weather
    WHERE journey_id = ?
    ORDER BY timestamp DESC, id DESC`,
    [journeyId],
  );
}
