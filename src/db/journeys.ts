import type * as SQLite from "expo-sqlite";

import { syncBackgroundTrackingForJourneyStatus } from "../tracking/locationTracking";
import {
  clearActiveJourneyIfMatches,
  syncActiveJourneySession,
} from "../storage/activeJourney";
import { unlinkIfExists } from "../files/fsCleanup";

import type { JourneyRow, JourneyStatus } from "./schema";

export async function getJourneyById(
  db: SQLite.SQLiteDatabase,
  id: number,
): Promise<JourneyRow | null> {
  const row = await db.getFirstAsync<{
    id: number;
    name: string;
    description: string | null;
    start_ts: number | null;
    end_ts: number | null;
    status: JourneyStatus;
  }>(
    `SELECT id, name, description, start_ts, end_ts, status FROM journey WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

export async function getMainScreenJourneyCandidate(
  db: SQLite.SQLiteDatabase,
): Promise<JourneyRow | null> {
  const row = await db.getFirstAsync<JourneyRow>(
    `SELECT id, name, description, start_ts, end_ts, status
     FROM journey
     WHERE status IN ('ongoing', 'paused', 'scheduled')
     ORDER BY CASE status
       WHEN 'ongoing' THEN 1
       WHEN 'paused' THEN 2
       WHEN 'scheduled' THEN 3
       ELSE 4
     END, id DESC
     LIMIT 1`,
  );
  return row ?? null;
}

export async function createJourney(
  db: SQLite.SQLiteDatabase,
  input: {
    name: string;
    description?: string | null;
    status?: JourneyStatus;
  },
): Promise<number> {
  const status = input.status ?? "scheduled";
  const result = await db.runAsync(
    `INSERT INTO journey (name, description, start_ts, end_ts, status) VALUES (?, ?, ?, ?, ?)`,
    [input.name, input.description ?? null, null, null, status],
  );
  const id = Number(result.lastInsertRowId);
  syncActiveJourneySession(id, status);
  if (status === "ongoing" || status === "paused") {
    await syncBackgroundTrackingForJourneyStatus(status);
  }
  return id;
}

export async function updateJourneyStatus(
  db: SQLite.SQLiteDatabase,
  journeyId: number,
  nextStatus: JourneyStatus,
): Promise<void> {
  const current = await getJourneyById(db, journeyId);
  if (!current) {
    throw new Error(`Journey ${journeyId} not found`);
  }

  let start_ts = current.start_ts;
  let end_ts = current.end_ts;
  const now = Date.now();

  if (nextStatus === "ongoing" && start_ts == null) {
    start_ts = now;
  }
  if (nextStatus === "completed" || nextStatus === "abandoned") {
    end_ts = now;
  }

  await db.runAsync(
    `UPDATE journey SET status = ?, start_ts = ?, end_ts = ? WHERE id = ?`,
    [nextStatus, start_ts, end_ts, journeyId],
  );

  syncActiveJourneySession(journeyId, nextStatus);
  await syncBackgroundTrackingForJourneyStatus(nextStatus);
}

/**
 * Deletes a journey after removing associated audio and image files from disk (PRD garbage collection).
 */
export async function deleteJourneyWithFileGc(
  db: SQLite.SQLiteDatabase,
  journeyId: number,
): Promise<void> {
  const notes = await db.getAllAsync<{ audio_file: string | null }>(
    `SELECT audio_file FROM note WHERE journey_id = ?`,
    [journeyId],
  );
  const media = await db.getAllAsync<{ file: string }>(
    `SELECT file FROM media WHERE journey_id = ?`,
    [journeyId],
  );

  for (const row of notes) {
    if (row.audio_file) {
      await unlinkIfExists(row.audio_file);
    }
  }
  for (const row of media) {
    await unlinkIfExists(row.file);
  }

  clearActiveJourneyIfMatches(journeyId);
  await db.runAsync(`DELETE FROM journey WHERE id = ?`, [journeyId]);
}
