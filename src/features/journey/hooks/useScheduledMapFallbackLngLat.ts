import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

import type { JourneyStatus } from "../../../db/schema";
import {
  getCachedCurrentLocation,
  subscribeCachedCurrentLocation,
  type CachedCurrentLocation,
} from "../../../location/currentLocationCache";

export type ScheduledMapFallbackLngLat = { lat: number; lng: number } | null;

/**
 * Live map fallback while journey is scheduled and has no points yet: last known
 * cached GPS from {@link getCachedCurrentLocation}. Subscribes on screen focus and
 * re-reads cache when the app returns to foreground.
 */
export function useScheduledMapFallbackLngLat(
  statusLabel: JourneyStatus | "",
  pointsLength: number,
): ScheduledMapFallbackLngLat {
  const [scheduledCachedLocation, setScheduledCachedLocation] =
    useState<CachedCurrentLocation | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (statusLabel !== "scheduled") {
        setScheduledCachedLocation(null);
        return;
      }
      setScheduledCachedLocation(getCachedCurrentLocation());
      const unsub = subscribeCachedCurrentLocation((coords) => {
        setScheduledCachedLocation(coords);
      });
      return unsub;
    }, [statusLabel]),
  );

  useEffect(() => {
    if (statusLabel !== "scheduled") {
      setScheduledCachedLocation(null);
      return;
    }
    setScheduledCachedLocation(getCachedCurrentLocation());
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        setScheduledCachedLocation(getCachedCurrentLocation());
      }
    });
    return () => {
      sub.remove();
    };
  }, [statusLabel]);

  return useMemo((): ScheduledMapFallbackLngLat => {
    if (statusLabel !== "scheduled") {
      return null;
    }
    if (pointsLength > 0) {
      return null;
    }
    return scheduledCachedLocation
      ? { lat: scheduledCachedLocation.lat, lng: scheduledCachedLocation.lng }
      : null;
  }, [pointsLength, statusLabel, scheduledCachedLocation]);
}
