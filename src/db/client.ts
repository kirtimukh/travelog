import * as SQLite from "expo-sqlite";

import { runMigrations } from "./migrations";

const DB_NAME = "mapmytrip.db";

let dbSingleton: SQLite.SQLiteDatabase | null = null;

/**
 * Opens the app database, enables foreign keys, runs migrations, and caches the instance.
 */
export async function openAppDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbSingleton) {
    return dbSingleton;
  }
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync("PRAGMA foreign_keys = ON");
  await runMigrations(db);
  dbSingleton = db;
  return db;
}

/** For tests or rare cases that need a fresh handle without the singleton. */
export function clearDatabaseSingletonForTests(): void {
  dbSingleton = null;
}
