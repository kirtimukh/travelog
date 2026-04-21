/**
 * TaskManager tasks must be registered at module load (not inside React).
 * Import this module once from the root layout before starting location updates.
 */
import type { LocationObject } from "expo-location";
import * as TaskManager from "expo-task-manager";

import { LOCATION_TASK_NAME, MAX_LOCATION_ACCURACY_METERS } from "./constants";

function filterLocations(locations: LocationObject[]): LocationObject[] {
  return locations.filter((loc) => {
    const acc = loc.coords.accuracy;
    if (acc == null) {
      return true;
    }
    return acc <= MAX_LOCATION_ACCURACY_METERS;
  });
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    return;
  }
  if (!data || typeof data !== "object") {
    return;
  }
  const locations = (data as { locations?: LocationObject[] }).locations;
  if (!locations?.length) {
    return;
  }
  const kept = filterLocations(locations);
  if (!kept.length) {
    return;
  }
  // Step 6: persist `kept` to `location_points` for active journey (activeJourneyId in MMKV).
});
