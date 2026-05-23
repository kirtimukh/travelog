import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { openAppDatabase } from "../../../db/client";
import { deleteJourneyWithFileGc } from "../../../db/journeys";
import type {
  JourneyRow,
  LocationPointRow,
  MediaRow,
  NoteRow,
} from "../../../db/schema";
import { onPermissionGranted } from "../../../location/currentLocationCache";
import { loadJourneyBundle } from "../bundle";
import { confirmTwoStepDestructiveAction } from "../confirmTwoStepDestructive";

type Params = {
  journeyId: number;
  refreshOngoingJourney: () => Promise<void>;
};

export type UseJourneyDetailsDataResult = {
  journey: JourneyRow | null;
  points: LocationPointRow[];
  notes: NoteRow[];
  media: MediaRow[];
  locationPermission: boolean;
  screenError: string | null;
  setScreenError: Dispatch<SetStateAction<string | null>>;
  deleteJourneyBusy: boolean;
  refresh: () => Promise<void>;
  requestPermission: () => Promise<void>;
  requestDeleteJourney: () => void;
};

export function useJourneyDetailsData({
  journeyId,
  refreshOngoingJourney,
}: Params): UseJourneyDetailsDataResult {
  const router = useRouter();
  const [journey, setJourney] = useState<JourneyRow | null>(null);
  const [points, setPoints] = useState<LocationPointRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [deleteJourneyBusy, setDeleteJourneyBusy] = useState<boolean>(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(journeyId)) {
      return;
    }
    const bundle = await loadJourneyBundle(journeyId);
    if (!bundle) {
      return;
    }
    setJourney(bundle.journey);
    setPoints(bundle.points);
    setNotes(bundle.notes);
    setMedia(bundle.media);
  }, [journeyId]);

  const requestDeleteJourney = useCallback((): void => {
    if (!journey || deleteJourneyBusy || !Number.isFinite(journeyId)) {
      return;
    }
    confirmTwoStepDestructiveAction({
      firstTitle: "Delete journey?",
      firstMessage: `This will remove "${journey.name}" and all associated notes, media, and location points.`,
      secondTitle: "Final confirmation",
      secondMessage:
        "This action is permanent and cannot be undone. Delete this journey now?",
      finalDestructiveLabel: "Delete permanently",
      onFinalConfirm: async () => {
        setDeleteJourneyBusy(true);
        setScreenError(null);
        try {
          const db = await openAppDatabase();
          await deleteJourneyWithFileGc(db, journeyId);
          await refreshOngoingJourney();
          router.replace("/journeys");
        } catch {
          setScreenError("Failed to delete journey.");
        } finally {
          setDeleteJourneyBusy(false);
        }
      },
    });
  }, [deleteJourneyBusy, journey, journeyId, refreshOngoingJourney, router]);

  const requestPermission = useCallback(async (): Promise<void> => {
    const res = await Location.requestForegroundPermissionsAsync();
    const granted = res.status === Location.PermissionStatus.GRANTED;
    setLocationPermission(granted);
    if (granted) {
      void onPermissionGranted();
    }
  }, []);

  useEffect(() => {
    void requestPermission();
    void refresh();
  }, [refresh, requestPermission]);

  return {
    journey,
    points,
    notes,
    media,
    locationPermission,
    screenError,
    setScreenError,
    deleteJourneyBusy,
    refresh,
    requestPermission,
    requestDeleteJourney,
  };
}
