import type * as SQLite from "expo-sqlite";
import * as Sentry from "@sentry/react-native";

import { syncBackgroundTrackingForJourneyStatus } from "../tracking/locationTracking";
import {
  clearActiveJourneyIfMatches,
  syncActiveJourneySession,
} from "../storage/activeJourney";
import { unlinkIfExists } from "../files/fsCleanup";

import { computeRecordedDurationMs } from "../features/journey/replay";
import { sumPathDistanceMeters } from "../features/journey/journeyMetrics";

import type { JourneyRow, JourneyStatus } from "./schema";
import { listLocationPointsForJourney } from "./locationPoints";

export type JourneyPauseWindow = {
  startTs: number;
  endTs: number | null;
};

type JourneyMetadata = {
  pauseWindows?: JourneyPauseWindow[];
};

function parseJourneyMetadata(metadata: string | null): JourneyMetadata {
  if (!metadata) {
    return {};
  }
  try {
    const parsed = JSON.parse(metadata) as JourneyMetadata;
    const pauseWindows = Array.isArray(parsed.pauseWindows)
      ? parsed.pauseWindows
          .filter(
            (entry): entry is JourneyPauseWindow =>
              typeof entry?.startTs === "number" &&
              (typeof entry.endTs === "number" || entry.endTs === null),
          )
          .map((entry) => ({ startTs: entry.startTs, endTs: entry.endTs }))
      : undefined;
    return pauseWindows ? { pauseWindows } : {};
  } catch {
    return {};
  }
}

function stringifyJourneyMetadata(metadata: JourneyMetadata): string | null {
  if (!metadata.pauseWindows || metadata.pauseWindows.length === 0) {
    return null;
  }
  return JSON.stringify({ pauseWindows: metadata.pauseWindows });
}

export type JourneyListFilters = {
  name?: string;
  status?: JourneyStatus | "all";
  inputDateTs?: number | null;
};

const JOURNEY_SELECT = `id, name, description, start_ts, end_ts, status, metadata, journey_duration_ms, recorded_duration_ms, recorded_distance`;

function mapJourneyRow(row: {
  id: number;
  name: string;
  description: string | null;
  start_ts: number | null;
  end_ts: number | null;
  status: JourneyStatus;
  metadata: string | null;
  journey_duration_ms: number | null;
  recorded_duration_ms: number | null;
  recorded_distance: number | null;
}): JourneyRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    start_ts: row.start_ts,
    end_ts: row.end_ts,
    status: row.status,
    metadata: row.metadata,
    journey_duration_ms: row.journey_duration_ms ?? null,
    recorded_duration_ms: row.recorded_duration_ms ?? null,
    recorded_distance: row.recorded_distance ?? null,
  };
}

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
    metadata: string | null;
    journey_duration_ms: number | null;
    recorded_duration_ms: number | null;
    recorded_distance: number | null;
  }>(`SELECT ${JOURNEY_SELECT} FROM journey WHERE id = ?`, [id]);
  return row ? mapJourneyRow(row) : null;
}

export async function getMainScreenJourneyCandidate(
  db: SQLite.SQLiteDatabase,
): Promise<JourneyRow | null> {
  const row = await db.getFirstAsync<{
    id: number;
    name: string;
    description: string | null;
    start_ts: number | null;
    end_ts: number | null;
    status: JourneyStatus;
    metadata: string | null;
    journey_duration_ms: number | null;
    recorded_duration_ms: number | null;
    recorded_distance: number | null;
  }>(
    `SELECT ${JOURNEY_SELECT}
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
  return row ? mapJourneyRow(row) : null;
}

/**
 * Inserts a journey row for import: `status` is always `completed`; no active-journey / tracking side effects.
 */
export async function insertJourneyForImport(
  db: SQLite.SQLiteDatabase,
  fields: {
    name: string;
    description: string | null;
    start_ts: number | null;
    end_ts: number | null;
    metadata: string | null;
    journey_duration_ms: number | null;
    recorded_duration_ms: number | null;
    recorded_distance: number | null;
  },
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO journey (name, description, start_ts, end_ts, status, metadata, journey_duration_ms, recorded_duration_ms, recorded_distance)
     VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
    [
      fields.name,
      fields.description,
      fields.start_ts,
      fields.end_ts,
      fields.metadata,
      fields.journey_duration_ms,
      fields.recorded_duration_ms,
      fields.recorded_distance,
    ],
  );
  return Number(result.lastInsertRowId);
}

export async function hasOngoingJourney(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ one: number }>(
    `SELECT 1 AS one FROM journey WHERE status = 'ongoing' LIMIT 1`,
  );
  return row != null;
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
    `INSERT INTO journey (name, description, start_ts, end_ts, status, metadata) VALUES (?, ?, ?, ?, ?, ?)`,
    [input.name, input.description ?? null, null, null, status, null],
  );
  const id = Number(result.lastInsertRowId);
  syncActiveJourneySession(id, status);
  if (status === "ongoing" || status === "paused") {
    await syncBackgroundTrackingForJourneyStatus(status);
  }
  return id;
}

export async function listJourneysWithFilters(
  db: SQLite.SQLiteDatabase,
  filters: JourneyListFilters = {},
): Promise<JourneyRow[]> {
  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  const trimmedName = filters.name?.trim();
  if (trimmedName) {
    whereClauses.push("LOWER(name) LIKE ?");
    params.push(`%${trimmedName.toLowerCase()}%`);
  }

  if (filters.status && filters.status !== "all") {
    whereClauses.push("status = ?");
    params.push(filters.status);
  }

  if (filters.inputDateTs != null) {
    whereClauses.push("start_ts IS NOT NULL");
    whereClauses.push("start_ts <= ?");
    whereClauses.push("(end_ts IS NULL OR end_ts >= ?)");
    params.push(filters.inputDateTs, filters.inputDateTs);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    description: string | null;
    start_ts: number | null;
    end_ts: number | null;
    status: JourneyStatus;
    metadata: string | null;
    journey_duration_ms: number | null;
    recorded_duration_ms: number | null;
    recorded_distance: number | null;
  }>(
    `SELECT ${JOURNEY_SELECT}
     FROM journey
     ${whereSql}
     ORDER BY id DESC`,
    params,
  );
  return rows.map(mapJourneyRow);
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
  const metadata = parseJourneyMetadata(current.metadata);
  const pauseWindows = [...(metadata.pauseWindows ?? [])];
  const now = Date.now();

  if (nextStatus === "ongoing" && start_ts == null) {
    start_ts = now;
  }
  if (current.status === "ongoing" && nextStatus === "paused") {
    pauseWindows.push({ startTs: now, endTs: null });
  }
  if (current.status === "paused" && nextStatus === "ongoing") {
    const latestOpenPause = [...pauseWindows].reverse().find((entry) => entry.endTs == null);
    if (latestOpenPause) {
      latestOpenPause.endTs = now;
    }
  }
  if (nextStatus === "completed" || nextStatus === "abandoned") {
    if (current.status === "paused") {
      const latestOpenPause = [...pauseWindows].reverse().find((entry) => entry.endTs == null);
      if (latestOpenPause) {
        latestOpenPause.endTs = now;
      }
    }
    end_ts = now;
  }
  const serializedMetadata = stringifyJourneyMetadata({ pauseWindows });

  if (nextStatus === "completed" && start_ts != null && end_ts != null) {
    const journey_duration_ms = Math.max(0, end_ts - start_ts);
    const provisionalJourney: JourneyRow = {
      id: current.id,
      name: current.name,
      description: current.description,
      start_ts,
      end_ts,
      status: "completed",
      metadata: serializedMetadata,
      journey_duration_ms: null,
      recorded_duration_ms: null,
      recorded_distance: null,
    };
    const recorded_duration_ms = computeRecordedDurationMs(provisionalJourney, end_ts);
    const points = await listLocationPointsForJourney(db, journeyId);
    const recorded_distance = sumPathDistanceMeters(points);

    await db.runAsync(
      `UPDATE journey SET status = ?, start_ts = ?, end_ts = ?, metadata = ?, journey_duration_ms = ?, recorded_duration_ms = ?, recorded_distance = ? WHERE id = ?`,
      [
        nextStatus,
        start_ts,
        end_ts,
        serializedMetadata,
        journey_duration_ms,
        recorded_duration_ms,
        recorded_distance,
        journeyId,
      ],
    );
  } else {
    await db.runAsync(
      `UPDATE journey SET status = ?, start_ts = ?, end_ts = ?, metadata = ? WHERE id = ?`,
      [nextStatus, start_ts, end_ts, serializedMetadata, journeyId],
    );
  }

  syncActiveJourneySession(journeyId, nextStatus);
  try {
    await syncBackgroundTrackingForJourneyStatus(nextStatus);
  } catch (trackingError) {
    Sentry.captureException(
      trackingError instanceof Error
        ? trackingError
        : new Error(String(trackingError)),
      {
        tags: { source: "updateJourneyStatus_tracking_sync" },
        extra: { journeyId, nextStatus, previousStatus: current.status },
      },
    );
  }
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
