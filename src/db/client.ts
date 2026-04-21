import * as SQLite from "expo-sqlite";

import { runMigrations } from "./migrations";

const DB_NAME = "mapmytrip.db";

let dbSingleton: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens the app database, enables foreign keys, runs migrations, and caches the instance.
 */
export async function openAppDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbSingleton) {
    return dbSingleton;
  }
  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME, {
      useNewConnection: true,
    });
    await db.execAsync("PRAGMA foreign_keys = ON");
    await runMigrations(db);
    dbSingleton = db;
    return db;
  })();

  try {
    return await dbInitPromise;
  } catch (error) {
    dbSingleton = null;
    throw error;
  } finally {
    dbInitPromise = null;
  }
}

/** For tests or rare cases that need a fresh handle without the singleton. */
export function clearDatabaseSingletonForTests(): void {
  dbSingleton = null;
  dbInitPromise = null;
}
