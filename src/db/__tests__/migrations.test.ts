/**
 * Validates schema migration orchestration for the local SQLite database.
 *
 * Coverage in this suite:
 * - Pending migrations execute in order and advance `PRAGMA user_version`.
 * - No-op behavior is preserved when the database is already up to date.
 * - Generated migration SQL includes critical product constraints (status/type
 *   checks and cascade foreign keys) so core data integrity rules are present.
 */
describe("runMigrations", () => {
  it("applies pending migrations in order and bumps user_version", async () => {
    const getFirstAsync = jest.fn().mockResolvedValueOnce({ user_version: 0 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    expect(execAsync).toHaveBeenCalledTimes(16);
    expect(execAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS journey"),
    );
    expect(execAsync).toHaveBeenNthCalledWith(2, "PRAGMA user_version = 1");
    expect(execAsync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("ALTER TABLE note ADD COLUMN audio_duration"),
    );
    expect(execAsync).toHaveBeenNthCalledWith(4, "PRAGMA user_version = 2");
    expect(execAsync).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("ALTER TABLE media ADD COLUMN width"),
    );
    expect(execAsync).toHaveBeenNthCalledWith(6, "PRAGMA user_version = 3");
    expect(execAsync).toHaveBeenNthCalledWith(
      7,
      expect.stringContaining("ALTER TABLE location_points ADD COLUMN heading"),
    );
    expect(execAsync).toHaveBeenNthCalledWith(8, "PRAGMA user_version = 4");
    expect(execAsync).toHaveBeenNthCalledWith(
      9,
      expect.stringContaining("ALTER TABLE journey ADD COLUMN metadata"),
    );
    expect(execAsync).toHaveBeenNthCalledWith(10, "PRAGMA user_version = 5");
    expect(execAsync).toHaveBeenNthCalledWith(
      11,
      expect.stringContaining("ALTER TABLE journey ADD COLUMN journey_duration_ms"),
    );
    expect(execAsync).toHaveBeenNthCalledWith(12, "PRAGMA user_version = 6");
    expect(execAsync).toHaveBeenNthCalledWith(
      13,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS weather"),
    );
    expect(execAsync).toHaveBeenNthCalledWith(14, "PRAGMA user_version = 7");
    expect(execAsync).toHaveBeenNthCalledWith(
      15,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS weather_quota_event"),
    );
    expect(execAsync).toHaveBeenNthCalledWith(16, "PRAGMA user_version = 8");
  });

  it("does nothing when already at latest version", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 8 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    expect(execAsync).not.toHaveBeenCalled();
  });

  it("includes essential PRD constraints in migration SQL", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    const sql = String(execAsync.mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("status IN ('scheduled', 'ongoing', 'completed', 'paused', 'abandoned')");
    expect(sql).toContain("type IN ('voice', 'text')");
    expect(sql).toContain("type IN ('image')");
    expect(sql).toContain("FOREIGN KEY (journey_id) REFERENCES journey(id) ON DELETE CASCADE");
  });

  it("adds audio_duration to note in migration v2", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    const v2Sql = String(execAsync.mock.calls[2]?.[0] ?? "");
    expect(v2Sql).toContain("ALTER TABLE note");
    expect(v2Sql).toContain("audio_duration");
  });

  it("adds media dimensions in migration v3", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    const v3Sql = String(execAsync.mock.calls[4]?.[0] ?? "");
    expect(v3Sql).toContain("ALTER TABLE media ADD COLUMN width");
    expect(v3Sql).toContain("ALTER TABLE media ADD COLUMN height");
  });

  it("adds location heading in migration v4", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    const v4Sql = String(execAsync.mock.calls[6]?.[0] ?? "");
    expect(v4Sql).toContain("ALTER TABLE location_points ADD COLUMN heading");
  });

  it("adds journey metadata in migration v5", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    const v5Sql = String(execAsync.mock.calls[8]?.[0] ?? "");
    expect(v5Sql).toContain("ALTER TABLE journey ADD COLUMN metadata");
  });

  it("adds journey metrics columns in migration v6", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    const v6Sql = String(execAsync.mock.calls[10]?.[0] ?? "");
    expect(v6Sql).toContain("journey_duration_ms");
    expect(v6Sql).toContain("recorded_duration_ms");
    expect(v6Sql).toContain("recorded_distance");
  });

  it("adds weather table and weather index in migration v7", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    const v7Sql = String(execAsync.mock.calls[12]?.[0] ?? "");
    expect(v7Sql).toContain("CREATE TABLE IF NOT EXISTS weather");
    expect(v7Sql).toContain("journey_id INTEGER NOT NULL");
    expect(v7Sql).toContain("weather_condition_icon TEXT");
    expect(v7Sql).toContain("full_data TEXT NOT NULL");
    expect(v7Sql).toContain("FOREIGN KEY (journey_id) REFERENCES journey(id) ON DELETE CASCADE");
    expect(v7Sql).toContain("CREATE INDEX IF NOT EXISTS idx_weather_journey_ts");
  });

  it("adds weather_quota_event table in migration v8", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    const v8Sql = String(execAsync.mock.calls[14]?.[0] ?? "");
    expect(v8Sql).toContain("CREATE TABLE IF NOT EXISTS weather_quota_event");
    expect(v8Sql).toContain("idx_weather_quota_event_ts");
  });
});
