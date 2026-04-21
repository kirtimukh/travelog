const mockCopyAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockDeleteAsync = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///app-docs/",
  copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

jest.mock("../uuid", () => ({
  randomUuid: () => "uuid-123",
}));

/**
 * Verifies file helper behavior that wraps Expo FileSystem operations.
 *
 * Coverage in this suite:
 * - `copyIntoAppDocumentsWithUuid` builds deterministic destination paths
 *   inside the app document directory and delegates the actual copy call.
 * - Missing `documentDirectory` is treated as a hard failure for copy flows.
 * - `unlinkIfExists` deletes only when a file exists and never throws even
 *   if metadata lookup fails, making cleanup paths safe to call best-effort.
 */
describe("file utilities", () => {
  beforeEach(() => {
    mockCopyAsync.mockReset();
    mockGetInfoAsync.mockReset();
    mockDeleteAsync.mockReset();
  });

  it("copies source to app documents with uuid filename", async () => {
    const {
      copyIntoAppDocumentsWithUuid,
    } = require("../appDocuments") as typeof import("../appDocuments");

    const dest = await copyIntoAppDocumentsWithUuid("file:///tmp/in.jpg", ".jpg");

    expect(dest).toBe("file:///app-docs/uuid-123.jpg");
    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: "file:///tmp/in.jpg",
      to: "file:///app-docs/uuid-123.jpg",
    });
  });

  it("throws when app document directory is missing", async () => {
    jest.doMock("expo-file-system/legacy", () => ({
      documentDirectory: "",
      copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
      getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
      deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
    }));
    jest.resetModules();

    const {
      copyIntoAppDocumentsWithUuid,
    } = require("../appDocuments") as typeof import("../appDocuments");

    await expect(
      copyIntoAppDocumentsWithUuid("file:///tmp/in.m4a", ".m4a"),
    ).rejects.toThrow("App document directory is not available");
  });

  it("unlinks only existing files and swallows errors", async () => {
    const { unlinkIfExists } = require("../fsCleanup") as typeof import("../fsCleanup");

    mockGetInfoAsync.mockResolvedValueOnce({ exists: false });
    await unlinkIfExists("file:///x.jpg");
    expect(mockDeleteAsync).not.toHaveBeenCalled();

    mockGetInfoAsync.mockResolvedValueOnce({ exists: true });
    await unlinkIfExists("file:///y.jpg");
    expect(mockDeleteAsync).toHaveBeenCalledWith("file:///y.jpg", {
      idempotent: true,
    });

    mockGetInfoAsync.mockRejectedValueOnce(new Error("boom"));
    await expect(unlinkIfExists("file:///z.jpg")).resolves.toBeUndefined();
  });
});
