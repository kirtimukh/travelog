import type * as SQLite from "expo-sqlite";

const MIGRATIONS: string[] = [
  // version 1
  `
  CREATE TABLE IF NOT EXISTS journey (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL CHECK (length(name) <= 100),
    description TEXT CHECK (description IS NULL OR length(description) <= 1000),
    start_ts INTEGER,
    end_ts INTEGER,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'ongoing', 'completed', 'paused', 'abandoned'))
  );

  CREATE TABLE IF NOT EXISTS location_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    journey_id INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    metadata TEXT,
    speed REAL,
    FOREIGN KEY (journey_id) REFERENCES journey(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_location_points_journey_ts
    ON location_points (journey_id, timestamp);

  CREATE TABLE IF NOT EXISTS note (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    journey_id INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    audio_file TEXT,
    audio_transcript TEXT,
    text TEXT CHECK (text IS NULL OR length(text) <= 1000),
    type TEXT NOT NULL CHECK (type IN ('voice', 'text')),
    FOREIGN KEY (journey_id) REFERENCES journey(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_note_journey_ts ON note (journey_id, timestamp);

  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    journey_id INTEGER NOT NULL,
    timestamp INTEGER,
    lat REAL,
    lng REAL,
    exif TEXT,
    text TEXT CHECK (text IS NULL OR length(text) <= 150),
    type TEXT NOT NULL CHECK (type IN ('image')),
    file TEXT NOT NULL,
    FOREIGN KEY (journey_id) REFERENCES journey(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_media_journey_ts ON media (journey_id, timestamp);
  `,
  // version 2 — voice note duration (seconds); legacy voice rows may keep NULL until backfilled.
  `
  ALTER TABLE note ADD COLUMN audio_duration INTEGER;
  `,
  // version 3 — image dimensions to support deterministic thumbnail aspect ratio.
  `
  ALTER TABLE media ADD COLUMN width REAL;
  ALTER TABLE media ADD COLUMN height REAL;
  `,
  // version 4 — replay heading as first-class location field.
  `
  ALTER TABLE location_points ADD COLUMN heading REAL;
  `,
  // version 5 — journey metadata for pause windows.
  `
  ALTER TABLE journey ADD COLUMN metadata TEXT;
  `,
  // version 6 — persisted journey metrics (set on completion).
  `
  ALTER TABLE journey ADD COLUMN journey_duration_ms INTEGER;
  ALTER TABLE journey ADD COLUMN recorded_duration_ms INTEGER;
  ALTER TABLE journey ADD COLUMN recorded_distance REAL;
  `,
  // version 7 — weather snapshots captured from Google Weather API.
  `
  CREATE TABLE IF NOT EXISTS weather (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    journey_id INTEGER NOT NULL,
    temperature REAL,
    feels_like_temperature REAL,
    weather_condition TEXT,
    weather_condition_icon TEXT,
    full_data TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    FOREIGN KEY (journey_id) REFERENCES journey(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_weather_journey_ts
    ON weather (journey_id, timestamp);
  `,
  // version 8 — successful weather API fetches (quota), independent of saved weather rows.
  `
  CREATE TABLE IF NOT EXISTS weather_quota_event (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    timestamp INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_weather_quota_event_ts
    ON weather_quota_event (timestamp);
  `,
];

/**
 * Applies pending migrations. Each migration string bumps user_version by 1.
 */
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    if (!sql?.trim()) {
      break;
    }
    await db.execAsync(sql);
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
