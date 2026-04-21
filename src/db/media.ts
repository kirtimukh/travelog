import type * as SQLite from "expo-sqlite";

import type { MediaRow } from "./schema";

export async function createMedia(
  db: SQLite.SQLiteDatabase,
  input: {
    journeyId: number;
    file: string;
    text?: string | null;
    timestamp?: number | null;
    lat?: number | null;
    lng?: number | null;
    exif?: string | null;
  },
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO media (journey_id, timestamp, lat, lng, exif, text, type, file)
     VALUES (?, ?, ?, ?, ?, ?, 'image', ?)`,
    [
      input.journeyId,
      input.timestamp ?? Date.now(),
      input.lat ?? null,
      input.lng ?? null,
      input.exif ?? null,
      input.text ?? null,
      input.file,
    ],
  );
  return Number(result.lastInsertRowId);
}

export async function listMediaForJourney(
  db: SQLite.SQLiteDatabase,
  journeyId: number,
): Promise<MediaRow[]> {
  const rows = await db.getAllAsync<MediaRow>(
    `SELECT id, journey_id, timestamp, lat, lng, exif, text, type, file
     FROM media
     WHERE journey_id = ?
     ORDER BY timestamp DESC, id DESC`,
    [journeyId],
  );
  return rows;
}

export async function updateMediaText(
  db: SQLite.SQLiteDatabase,
  mediaId: number,
  text: string | null,
): Promise<void> {
  await db.runAsync(`UPDATE media SET text = ? WHERE id = ?`, [text, mediaId]);
}

export async function deleteMediaById(
  db: SQLite.SQLiteDatabase,
  mediaId: number,
): Promise<void> {
  await db.runAsync(`DELETE FROM media WHERE id = ?`, [mediaId]);
}
