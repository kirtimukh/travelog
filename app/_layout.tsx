import "../global.css";
import "../src/tracking/locationTask";

import * as Battery from "expo-battery";
import * as SplashScreen from "expo-splash-screen";
import {
  Stack,
  usePathname,
  useRouter,
  useRootNavigationState,
} from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";

import { openAppDatabase } from "../src/db/client";
import { getJourneyById } from "../src/db/journeys";
import {
  clearActiveJourneyId,
  getActiveJourneyId,
} from "../src/storage/activeJourney";
import { hasValidPmtilesPackage } from "../src/storage/pmtilesGuard";
import { refreshLocationTrackingAccuracyIfRunning } from "../src/tracking/locationTracking";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const pathname = usePathname();

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
        const hasValidPmtiles = await hasValidPmtilesPackage();
        if (!hasValidPmtiles) {
          if (pathname?.startsWith("/journey/")) {
            router.replace("/");
          }
        }
        const id = getActiveJourneyId();
        if (id != null && hasValidPmtiles) {
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
  }, [navState?.key, pathname, router]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        return;
      }
      void (async () => {
        const hasValidPmtiles = await hasValidPmtilesPackage();
        if (hasValidPmtiles) {
          return;
        }
        if (pathname?.startsWith("/journey/")) {
          router.replace("/");
        }
      })();
    });
    return () => sub.remove();
  }, [pathname, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: "MapMyTrip",
      }}
    />
  );
}
