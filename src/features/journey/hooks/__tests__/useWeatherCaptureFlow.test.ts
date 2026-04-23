import { computeWeatherCallsLeft } from "../../weatherQuota";

describe("computeWeatherCallsLeft", () => {
  it("returns full quota when there are no requests", () => {
    expect(computeWeatherCallsLeft([], 1_000_000)).toBe(2);
  });

  it("counts only requests in the last 15 minutes", () => {
    const now = 1_000_000;
    const fifteenMinutes = 15 * 60 * 1000;
    const insideWindow = now - 5 * 60 * 1000;
    const outsideWindow = now - fifteenMinutes - 1;
    expect(computeWeatherCallsLeft([insideWindow, outsideWindow], now)).toBe(1);
  });

  it("never returns a negative value", () => {
    const now = 1_000_000;
    const insideWindowA = now - 10_000;
    const insideWindowB = now - 20_000;
    const insideWindowC = now - 30_000;
    expect(computeWeatherCallsLeft([insideWindowA, insideWindowB, insideWindowC], now)).toBe(0);
  });
});
