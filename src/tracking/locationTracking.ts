import * as Battery from "expo-battery";
import * as Location from "expo-location";

import type { JourneyStatus } from "../db/schema";

import {
  BATTERY_RECOVERY_FRACTION,
  LOCATION_TASK_NAME,
  LOW_BATTERY_FRACTION,
} from "./constants";

type AccuracyMode = "high" | "reduced";

let currentAccuracyMode: AccuracyMode | null = null;

async function resolveAccuracyMode(): Promise<AccuracyMode> {
  const available = await Battery.isAvailableAsync();
  if (!available) {
    return "high";
  }
  const level = await Battery.getBatteryLevelAsync();
  if (level < 0) {
    return "high";
  }
  if (currentAccuracyMode === "reduced") {
    if (level >= BATTERY_RECOVERY_FRACTION) {
      return "high";
    }
    return "reduced";
  }
  if (level < LOW_BATTERY_FRACTION) {
    return "reduced";
  }
  return "high";
}

function buildTaskOptions(mode: AccuracyMode): Location.LocationTaskOptions {
  const highAccuracy =
    mode === "high"
      ? Location.LocationAccuracy.BestForNavigation
      : Location.LocationAccuracy.Balanced;

  return {
    accuracy: highAccuracy,
    distanceInterval: 10,
    timeInterval: 5000,
    activityType: Location.LocationActivityType.Fitness,
    foregroundService: {
      notificationTitle: "MapMyTrip",
      notificationBody: "Recording your journey in the background.",
      notificationColor: "#1D4ED8",
    },
    showsBackgroundLocationIndicator: true,
  };
}

/**
 * Request foreground + background location permissions needed for ongoing tracking.
 */
export async function requestLocationPermissionsForTracking(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    return false;
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === Location.PermissionStatus.GRANTED;
}

/**
 * Starts background location updates with battery-aware accuracy. No-op if already running.
 */
export async function startOngoingLocationTracking(): Promise<void> {
  const mode = await resolveAccuracyMode();
  currentAccuracyMode = mode;

  const started = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME,
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  await Location.startLocationUpdatesAsync(
    LOCATION_TASK_NAME,
    buildTaskOptions(mode),
  );
}

/**
 * Stops background location updates (e.g. when journey is no longer ongoing).
 */
export async function stopOngoingLocationTracking(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME,
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  currentAccuracyMode = null;
}

/**
 * If location updates are active, restarts them when battery crosses the low/high threshold.
 */
/**
 * Keeps background GPS aligned with journey status: ongoing → start (after permissions), else stop.
 */
export async function syncBackgroundTrackingForJourneyStatus(
  status: JourneyStatus,
): Promise<void> {
  if (status === "ongoing") {
    const ok = await requestLocationPermissionsForTracking();
    if (!ok) {
      return;
    }
    await startOngoingLocationTracking();
    return;
  }
  await stopOngoingLocationTracking();
}

export async function refreshLocationTrackingAccuracyIfRunning(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME,
  );
  if (!started) {
    return;
  }

  const nextMode = await resolveAccuracyMode();
  if (nextMode === currentAccuracyMode) {
    return;
  }

  currentAccuracyMode = nextMode;
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  await Location.startLocationUpdatesAsync(
    LOCATION_TASK_NAME,
    buildTaskOptions(nextMode),
  );
}
