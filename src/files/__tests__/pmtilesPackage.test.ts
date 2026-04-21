const mockGetInfoAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///app-docs/",
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
}));

jest.mock("../../storage/pmtilesConfig", () => ({
  REQUIRED_PMTILES_FILENAME: "india-ne.pmtiles",
}));

describe("pmtiles package helpers", () => {
  beforeEach(() => {
    mockGetInfoAsync.mockReset();
    mockCopyAsync.mockReset();
    mockMakeDirectoryAsync.mockReset();
  });

  it("rejects path with unexpected filename", async () => {
    const { validateRequiredPmtiles } = require("../pmtilesPackage") as typeof import("../pmtilesPackage");
    await expect(
      validateRequiredPmtiles("file:///app-docs/maptiles/wrong.pmtiles"),
    ).resolves.toEqual({
      valid: false,
      reason: "PMTiles filename is not india-ne.pmtiles",
    });
  });

  it("returns invalid when file does not exist", async () => {
    const { validateRequiredPmtiles } = require("../pmtilesPackage") as typeof import("../pmtilesPackage");
    mockGetInfoAsync.mockResolvedValueOnce({ exists: false });
    await expect(
      validateRequiredPmtiles("file:///app-docs/maptiles/india-ne.pmtiles"),
    ).resolves.toEqual({
      valid: false,
      reason: "PMTiles file does not exist",
    });
  });

  it("copies expected filename into app documents", async () => {
    const { copyRequiredPmtilesIntoAppDocuments } = require("../pmtilesPackage") as typeof import("../pmtilesPackage");
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, size: 1024, md5: "abc123" });

    const result = await copyRequiredPmtilesIntoAppDocuments(
      "file:///downloads/india-ne.pmtiles",
    );

    expect(mockMakeDirectoryAsync).toHaveBeenCalledWith("file:///app-docs/maptiles", {
      intermediates: true,
    });
    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: "file:///downloads/india-ne.pmtiles",
      to: "file:///app-docs/maptiles/india-ne.pmtiles",
    });
    expect(result).toEqual({
      destUri: "file:///app-docs/maptiles/india-ne.pmtiles",
      size: 1024,
      hash: "abc123",
    });
  });
});
