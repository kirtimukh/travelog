import { cacheWeatherIcon } from "../iconCache";

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
}));

describe("cacheWeatherIcon", () => {
  it("downloads icon once and reuses cached file path", async () => {
    const fs = require("expo-file-system/legacy") as {
      getInfoAsync: jest.Mock;
      makeDirectoryAsync: jest.Mock;
      downloadAsync: jest.Mock;
    };

    const downloadedPaths = new Set<string>();
    fs.getInfoAsync.mockImplementation(async (path: string) => {
      if (path.endsWith("/weather-icons/")) {
        return { exists: true };
      }
      return { exists: downloadedPaths.has(path) };
    });
    fs.makeDirectoryAsync.mockResolvedValue(undefined);
    fs.downloadAsync.mockImplementation(async (_url: string, to: string) => {
      downloadedPaths.add(to);
      return { uri: to };
    });

    const first = await cacheWeatherIcon("https://example.com/icon");
    const second = await cacheWeatherIcon("https://example.com/icon");

    expect(first).toBe(second);
    expect(fs.downloadAsync).toHaveBeenCalledTimes(1);
  });
});
