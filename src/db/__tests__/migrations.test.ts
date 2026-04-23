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

    expect(execAsync).toHaveBeenCalledTimes(8);
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
  });

  it("does nothing when already at latest version", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 4 });
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
});
