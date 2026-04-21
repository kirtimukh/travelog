/** Background task name — must match TaskManager.defineTask and startLocationUpdatesAsync. */
export const LOCATION_TASK_NAME = "MAP_MY_TRIP_BG_LOCATION";

/** PRD: discard GPS readings worse than this (meters). */
export const MAX_LOCATION_ACCURACY_METERS = 20;

/** PRD: below this battery fraction, use reduced location accuracy. */
export const LOW_BATTERY_FRACTION = 0.1;

/** Re-enable high accuracy above this level to avoid flapping (optional hysteresis). */
export const BATTERY_RECOVERY_FRACTION = 0.12;

/** PRD: commit a LocationPoint only if movement exceeds this (meters) OR time below elapses. */
export const MIN_MOVEMENT_METERS = 10;

/** PRD: commit a LocationPoint if this many ms have passed since last commit (OR with distance). */
export const MIN_TIME_BETWEEN_COMMITS_MS = 5000;
