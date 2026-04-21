import "../global.css";
import "../src/tracking/locationTask";

import * as Battery from "expo-battery";
import * as SplashScreen from "expo-splash-screen";
import { Stack, useRouter, useRootNavigationState } from "expo-router";
import { useEffect } from "react";

import { openAppDatabase } from "../src/db/client";
import { getJourneyById } from "../src/db/journeys";
import {
  clearActiveJourneyId,
  getActiveJourneyId,
} from "../src/storage/activeJourney";
import { refreshLocationTrackingAccuracyIfRunning } from "../src/tracking/locationTracking";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    const levelSub = Battery.addBatteryLevelListener(() => {
      void refreshLocationTrackingAccuracyIfRunning();
    });
    const stateSub = Battery.addBatteryStateListener(() => {
      void refreshLocationTrackingAccuracyIfRunning();
    });
    return () => {
      levelSub.remove();
      stateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!navState?.key) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await openAppDatabase();
        const id = getActiveJourneyId();
        if (id != null) {
          const db = await openAppDatabase();
          const journey = await getJourneyById(db, id);
          if (cancelled) {
            return;
          }
          if (!journey) {
            clearActiveJourneyId();
          } else if (
            journey.status === "ongoing" ||
            journey.status === "paused"
          ) {
            router.replace(`/journey/${id}`);
          } else {
            clearActiveJourneyId();
          }
        }
      } catch {
        // MMKV/SQLite may fail in unsupported environments; still show UI.
      } finally {
        if (!cancelled) {
          await SplashScreen.hideAsync();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navState?.key, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: "MapMyTrip",
      }}
    />
  );
}
