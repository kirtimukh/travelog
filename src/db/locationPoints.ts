import type * as SQLite from "expo-sqlite";

import type { LocationPointRow } from "./schema";

export async function insertLocationPoint(
  db: SQLite.SQLiteDatabase,
  input: {
    journeyId: number;
    lat: number;
    lng: number;
    timestamp: number;
    metadata?: string | null;
    speed?: number | null;
    heading?: number | null;
  },
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO location_points (journey_id, lat, lng, timestamp, metadata, speed, heading)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.journeyId,
      input.lat,
      input.lng,
      input.timestamp,
      input.metadata ?? null,
      input.speed ?? null,
      input.heading ?? null,
    ],
  );
  return result.lastInsertRowId;
}

export async function getLastLocationPointForJourney(
  db: SQLite.SQLiteDatabase,
  journeyId: number,
): Promise<LocationPointRow | null> {
  const row = await db.getFirstAsync<{
    id: number;
    journey_id: number;
    lat: number;
    lng: number;
    timestamp: number;
    metadata: string | null;
    speed: number | null;
    heading: number | null;
  }>(
    `SELECT id, journey_id, lat, lng, timestamp, metadata, speed, heading
     FROM location_points
     WHERE journey_id = ?
     ORDER BY timestamp DESC
     LIMIT 1`,
    [journeyId],
  );
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    journey_id: row.journey_id,
    lat: row.lat,
    lng: row.lng,
    timestamp: row.timestamp,
    metadata: row.metadata,
    speed: row.speed,
    heading: row.heading,
  };
}

export async function listLocationPointsForJourney(
  db: SQLite.SQLiteDatabase,
  journeyId: number,
): Promise<LocationPointRow[]> {
  const rows = await db.getAllAsync<{
    id: number;
    journey_id: number;
    lat: number;
    lng: number;
    timestamp: number;
    metadata: string | null;
    speed: number | null;
    heading: number | null;
  }>(
    `SELECT id, journey_id, lat, lng, timestamp, metadata, speed, heading
     FROM location_points
     WHERE journey_id = ?
     ORDER BY timestamp ASC`,
    [journeyId],
  );
  return rows.map((row) => ({
    id: row.id,
    journey_id: row.journey_id,
    lat: row.lat,
    lng: row.lng,
    timestamp: row.timestamp,
    metadata: row.metadata,
    speed: row.speed,
    heading: row.heading,
  }));
}
