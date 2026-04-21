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
  it("applies pending migration and bumps user_version", async () => {
    const getFirstAsync = jest
      .fn()
      .mockResolvedValueOnce({ user_version: 0 })
      .mockResolvedValueOnce({ user_version: 1 });
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const db = { getFirstAsync, execAsync };

    const { runMigrations } = require("../migrations") as typeof import("../migrations");
    await runMigrations(db as never);

    expect(execAsync).toHaveBeenCalledTimes(2);
    expect(execAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS journey"),
    );
    expect(execAsync).toHaveBeenNthCalledWith(2, "PRAGMA user_version = 1");
  });

  it("does nothing when already at latest version", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 1 });
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
});
