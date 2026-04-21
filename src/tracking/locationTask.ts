/**
 * TaskManager tasks must be registered at module load (not inside React).
 * Import this module once from the root layout before starting location updates.
 */
import type { LocationObject } from "expo-location";
import * as TaskManager from "expo-task-manager";

import { openAppDatabase } from "../db/client";
import { getJourneyById } from "../db/journeys";
import {
  getLastLocationPointForJourney,
  insertLocationPoint,
} from "../db/locationPoints";
import { getActiveJourneyId } from "../storage/activeJourney";
import { distanceMeters } from "../geo/distance";

import {
  LOCATION_TASK_NAME,
  MAX_LOCATION_ACCURACY_METERS,
  MIN_MOVEMENT_METERS,
  MIN_TIME_BETWEEN_COMMITS_MS,
} from "./constants";

function filterLocations(locations: LocationObject[]): LocationObject[] {
  return locations.filter((loc) => {
    const acc = loc.coords.accuracy;
    if (acc == null) {
      return true;
    }
    return acc <= MAX_LOCATION_ACCURACY_METERS;
  });
}

function hasFiniteCoordinates(
  loc: LocationObject,
): loc is LocationObject & { timestamp: number } {
  return (
    Number.isFinite(loc.coords.latitude) &&
    Number.isFinite(loc.coords.longitude) &&
    Number.isFinite(loc.timestamp)
  );
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  try {
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
    const kept = filterLocations(locations).filter(hasFiniteCoordinates);
    if (!kept.length) {
      return;
    }

    const activeId = getActiveJourneyId();
    if (activeId == null) {
      return;
    }

    const db = await openAppDatabase();
    const journey = await getJourneyById(db, activeId);
    if (!journey || journey.status !== "ongoing") {
      return;
    }

    const sorted = [...kept].sort((a, b) => a.timestamp - b.timestamp);
    const lastRow = await getLastLocationPointForJourney(db, activeId);
    let last:
      | { lat: number; lng: number; timestamp: number }
      | null = lastRow
      ? { lat: lastRow.lat, lng: lastRow.lng, timestamp: lastRow.timestamp }
      : null;

    for (const loc of sorted) {
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      const ts = loc.timestamp;
      const speed = loc.coords.speed;

      if (last == null) {
        await insertLocationPoint(db, {
          journeyId: activeId,
          lat,
          lng,
          timestamp: ts,
          speed,
          metadata: null,
        });
        last = { lat, lng, timestamp: ts };
        continue;
      }

      const dist = distanceMeters(last.lat, last.lng, lat, lng);
      const dt = ts - last.timestamp;
      if (dist >= MIN_MOVEMENT_METERS || dt >= MIN_TIME_BETWEEN_COMMITS_MS) {
        await insertLocationPoint(db, {
          journeyId: activeId,
          lat,
          lng,
          timestamp: ts,
          speed,
          metadata: null,
        });
        last = { lat, lng, timestamp: ts };
      }
    }
  } catch (taskError) {
    const message =
      taskError instanceof Error ? taskError.message : String(taskError);
    console.warn(`[${LOCATION_TASK_NAME}] failed to persist locations: ${message}`);
  }
});
