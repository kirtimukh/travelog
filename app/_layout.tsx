import "react-native-gesture-handler";

import "../global.css";
import "../src/tracking/locationTask";

import * as Battery from "expo-battery";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider } from "@react-navigation/native";
import {
  Stack,
  usePathname,
  useRouter,
  useRootNavigationState,
} from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { subscribeCurrentLocationCacheAppState } from "../src/location/currentLocationCache";
import { appNavigationTheme } from "../src/theme/navigationTheme";
import { hasValidPmtilesPackage } from "../src/storage/pmtilesGuard";
import { refreshLocationTrackingAccuracyIfRunning } from "../src/tracking/locationTracking";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const pathname = usePathname();

  useEffect(() => {
    return subscribeCurrentLocationCacheAppState();
  }, []);

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

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={appNavigationTheme}>
        <Stack
          screenOptions={{
            headerShown: true,
            // Default `title` (not string `headerTitle`) so screens can override via setOptions({ title }).
            title: "MapMyTrip",
          }}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
