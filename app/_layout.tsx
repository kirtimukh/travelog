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
