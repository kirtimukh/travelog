import type { LocationPointRow } from "../../db/schema";
import { distanceMeters } from "../../geo/distance";

/** Cumulative path length over committed points in timestamp order (meters). */
export function sumPathDistanceMeters(points: LocationPointRow[]): number {
  if (points.length < 2) {
    return 0;
  }
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    sum += distanceMeters(a.lat, a.lng, b.lat, b.lng);
  }
  return sum;
}
