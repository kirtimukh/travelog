import * as SQLite from "expo-sqlite";

const DB_NAME = "mapmytrip.db";

/**
 * Opens the app SQLite database and verifies native I/O with PRAGMA user_version.
 * Full PRD schema is added in a later step.
 */
export async function openAppDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  return db;
}
