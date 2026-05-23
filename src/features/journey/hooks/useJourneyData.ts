import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { openAppDatabase } from "../../../db/client";
import { listLocationPointsForJourney } from "../../../db/locationPoints";
import type {
  JourneyRow,
  JourneyStatus,
  LocationPointRow,
  MediaRow,
  NoteRow,
} from "../../../db/schema";
import { onPermissionGranted } from "../../../location/currentLocationCache";
import { syncActiveJourneySession } from "../../../storage/activeJourney";
import { hasValidPmtilesPackage } from "../../../storage/pmtilesGuard";
import { syncBackgroundTrackingForJourneyStatus } from "../../../tracking/locationTracking";
import { loadJourneyBundle as loadJourneyBundleData } from "../bundle";

export type UseJourneyDataResult = {
  journey: JourneyRow | null;
  name: string;
  statusLabel: JourneyStatus | "";
  points: LocationPointRow[];
  notes: NoteRow[];
  media: MediaRow[];
  error: string | null;
  locationPermission: "unknown" | "granted" | "denied";
  needsBackgroundLocationSettings: boolean;
  requestMapPermission: () => Promise<boolean>;
  refreshJourneyData: () => Promise<void>;
};

export function useJourneyData(journeyId: number): UseJourneyDataResult {
  const router = useRouter();
  const [journey, setJourney] = useState<JourneyRow | null>(null);
  const [name, setName] = useState<string>("Journey");
  const [statusLabel, setStatusLabel] = useState<JourneyStatus | "">("");
  const [points, setPoints] = useState<LocationPointRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const [needsBackgroundLocationSettings, setNeedsBackgroundLocationSettings] =
    useState<boolean>(false);

  const loadJourneyBundle = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(journeyId)) {
      return;
    }
    const bundle = await loadJourneyBundleData(journeyId);
    if (!bundle) {
      return;
    }
    const {
      journey,
      points: loadedPoints,
      notes: loadedNotes,
      media: loadedMedia,
    } = bundle;
    setJourney(journey);
    setName(journey.name);
    setStatusLabel(journey.status);
    setPoints(loadedPoints);
    setNotes(loadedNotes);
    setMedia(loadedMedia);
    syncActiveJourneySession(journey.id, journey.status);
    const trackingSync = await syncBackgroundTrackingForJourneyStatus(journey.status);
    if (journey.status === "ongoing" && !trackingSync.started) {
      setNeedsBackgroundLocationSettings(
        trackingSync.permissionOutcome === "background-denied" ||
          trackingSync.permissionOutcome === "background-error",
      );
      if (trackingSync.message) {
        setError(trackingSync.message);
      }
    } else {
      setNeedsBackgroundLocationSettings(false);
    }
  }, [journeyId]);

  const requestMapPermission = useCallback(async (): Promise<boolean> => {
    const res = await Location.requestForegroundPermissionsAsync();
    const granted = res.status === Location.PermissionStatus.GRANTED;
    setLocationPermission(granted ? "granted" : "denied");
    if (granted) {
      void onPermissionGranted();
    }
    return granted;
  }, []);

  const refreshJourneyData = useCallback(async (): Promise<void> => {
    await loadJourneyBundle();
  }, [loadJourneyBundle]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!Number.isFinite(journeyId)) {
        return;
      }
      if (!(await hasValidPmtilesPackage())) {
        router.replace("/");
        return;
      }
      const granted = await requestMapPermission();
      if (!granted && !cancelled) {
        setError("Location permission is required to render the map.");
      }
      await loadJourneyBundle();
    })();
    return () => {
      cancelled = true;
    };
  }, [journeyId, loadJourneyBundle, requestMapPermission, router]);

  useEffect(() => {
    if (!Number.isFinite(journeyId) || statusLabel !== "ongoing") {
      return;
    }
    const intervalId = setInterval(() => {
      void (async () => {
        const db = await openAppDatabase();
        const latestPoints = await listLocationPointsForJourney(db, journeyId);
        setPoints(latestPoints);
      })();
    }, 3000);
    return () => {
      clearInterval(intervalId);
    };
  }, [journeyId, statusLabel]);

  return {
    journey,
    name,
    statusLabel,
    points,
    notes,
    media,
    error,
    locationPermission,
    needsBackgroundLocationSettings,
    requestMapPermission,
    refreshJourneyData,
  };
}
