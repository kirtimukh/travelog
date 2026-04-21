import type * as SQLite from "expo-sqlite";

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
