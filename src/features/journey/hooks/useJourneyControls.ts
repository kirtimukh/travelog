import * as Location from "expo-location";
import { useCallback, useState } from "react";

import { openAppDatabase } from "../../../db/client";
import { updateJourneyStatus } from "../../../db/journeys";
import { insertLocationPoint } from "../../../db/locationPoints";
import type { JourneyStatus } from "../../../db/schema";

type Params = {
  journeyId: number;
  statusLabel: JourneyStatus | "";
  locationPermission: "unknown" | "granted" | "denied";
  refreshJourneyData: () => Promise<void>;
  refreshOngoingJourney: () => Promise<void>;
  requestMapPermission: () => Promise<boolean>;
};

export type UseJourneyControlsResult = {
  busy: boolean;
  error: string | null;
  onJourneyActionPress: () => Promise<void>;
  endJourney: () => Promise<void>;
};

export function useJourneyControls({
  journeyId,
  statusLabel,
  locationPermission,
  refreshJourneyData,
  refreshOngoingJourney,
  requestMapPermission,
}: Params): UseJourneyControlsResult {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordCurrentPointNow = useCallback(async (): Promise<void> => {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.LocationAccuracy.Balanced,
    });
    const db = await openAppDatabase();
    await insertLocationPoint(db, {
      journeyId,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      timestamp: pos.timestamp || Date.now(),
      speed: pos.coords.speed ?? null,
      heading: pos.coords.heading ?? null,
      metadata: JSON.stringify(pos),
    });
  }, [journeyId]);

  const onJourneyActionPress = useCallback(async (): Promise<void> => {
    if (!statusLabel || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const db = await openAppDatabase();
      if (statusLabel === "scheduled") {
        const granted =
          locationPermission === "granted" ? true : await requestMapPermission();
        if (!granted) {
          throw new Error(
            "Location permission is required to start and map this journey.",
          );
        }
        await updateJourneyStatus(db, journeyId, "ongoing");
        await recordCurrentPointNow();
      } else if (statusLabel === "ongoing") {
        await updateJourneyStatus(db, journeyId, "paused");
      } else if (statusLabel === "paused") {
        await updateJourneyStatus(db, journeyId, "ongoing");
      }
      await refreshJourneyData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    journeyId,
    locationPermission,
    recordCurrentPointNow,
    refreshJourneyData,
    requestMapPermission,
    statusLabel,
  ]);

  const endJourney = useCallback(async (): Promise<void> => {
    if (!statusLabel || busy || statusLabel === "completed") {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const db = await openAppDatabase();
      await updateJourneyStatus(db, journeyId, "completed");
      await refreshJourneyData();
      await refreshOngoingJourney();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end journey.");
    } finally {
      setBusy(false);
    }
  }, [busy, journeyId, refreshJourneyData, refreshOngoingJourney, statusLabel]);

  return { busy, error, onJourneyActionPress, endJourney };
}
