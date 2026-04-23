import type { LocationPointRow } from "../../../db/schema";
import { sumPathDistanceMeters } from "../journeyMetrics";

function point(
  id: number,
  journey_id: number,
  lat: number,
  lng: number,
  timestamp: number,
): LocationPointRow {
  return {
    id,
    journey_id,
    lat,
    lng,
    timestamp,
    metadata: null,
    speed: null,
    heading: null,
  };
}

describe("sumPathDistanceMeters", () => {
  it("returns 0 for fewer than two points", () => {
    expect(sumPathDistanceMeters([])).toBe(0);
    expect(sumPathDistanceMeters([point(1, 1, 0, 0, 1)])).toBe(0);
  });

  it("sums segment lengths in order", () => {
    const a = point(1, 1, 0, 0, 1_000);
    const b = point(2, 1, 0, 0.001, 2_000);
    const c = point(3, 1, 0, 0.002, 3_000);
    const total = sumPathDistanceMeters([a, b, c]);
    expect(total).toBeGreaterThan(0);
    expect(Number.isFinite(total)).toBe(true);
  });
});
