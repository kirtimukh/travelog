const QUOTA_MAX_CALLS = 2;
const QUOTA_WINDOW_MS = 15 * 60 * 1000;

export { QUOTA_MAX_CALLS, QUOTA_WINDOW_MS };

export function computeWeatherCallsLeft(requestTimestamps: number[], now: number): number {
  const minTs = now - QUOTA_WINDOW_MS;
  const used = requestTimestamps.filter((ts) => ts >= minTs).length;
  return Math.max(0, QUOTA_MAX_CALLS - used);
}
