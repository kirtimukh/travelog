const mockValidate = jest.fn();
const mockGetPmtilesConfig = jest.fn();
const mockClearPmtilesConfig = jest.fn();

jest.mock("../../files/pmtilesPackage", () => ({
  validateRequiredPmtiles: (...args: unknown[]) => mockValidate(...args),
}));

jest.mock("../pmtilesConfig", () => ({
  getPmtilesConfig: () => mockGetPmtilesConfig(),
  clearPmtilesConfig: () => mockClearPmtilesConfig(),
}));

describe("pmtiles guard", () => {
  beforeEach(() => {
    mockValidate.mockReset();
    mockGetPmtilesConfig.mockReset();
    mockClearPmtilesConfig.mockReset();
  });

  it("returns true when PMTiles is valid", async () => {
    const { hasValidPmtilesPackage } = require("../pmtilesGuard") as typeof import("../pmtilesGuard");
    mockGetPmtilesConfig.mockReturnValue({
      pmtilesPath: "file:///ok/india-ne.pmtiles",
    });
    mockValidate.mockResolvedValue({ valid: true });

    await expect(hasValidPmtilesPackage()).resolves.toBe(true);
    expect(mockValidate).toHaveBeenCalledWith("file:///ok/india-ne.pmtiles");
    expect(mockClearPmtilesConfig).not.toHaveBeenCalled();
  });

  it("clears stale config and returns false when invalid", async () => {
    const { hasValidPmtilesPackage } = require("../pmtilesGuard") as typeof import("../pmtilesGuard");
    mockGetPmtilesConfig.mockReturnValue({
      pmtilesPath: "file:///missing/india-ne.pmtiles",
    });
    mockValidate.mockResolvedValue({ valid: false, reason: "missing" });

    await expect(hasValidPmtilesPackage()).resolves.toBe(false);
    expect(mockValidate).toHaveBeenCalledWith("file:///missing/india-ne.pmtiles");
    expect(mockClearPmtilesConfig).toHaveBeenCalledTimes(1);
  });

  it("clears config when pmtiles path is missing", async () => {
    const { hasValidPmtilesPackage } = require("../pmtilesGuard") as typeof import("../pmtilesGuard");
    mockGetPmtilesConfig.mockReturnValue(null);
    mockValidate.mockResolvedValue({
      valid: false,
      reason: "Missing PMTiles path",
    });

    await expect(hasValidPmtilesPackage()).resolves.toBe(false);
    expect(mockValidate).toHaveBeenCalledWith(undefined);
    expect(mockClearPmtilesConfig).toHaveBeenCalledTimes(1);
  });
});
