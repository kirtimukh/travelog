import "react-native-gesture-handler";

import "../global.css";
import "../src/tracking/locationTask";

import * as Battery from "expo-battery";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider } from "@react-navigation/native";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import "../src/diagnostics/installErrorLogging";
import { AppErrorBoundary } from "../src/diagnostics/AppErrorBoundary";
import { RouteCapture } from "../src/diagnostics/RouteCapture";
import { subscribeCurrentLocationCacheAppState } from "../src/location/currentLocationCache";
import { appNavigationTheme } from "../src/theme/navigationTheme";
import { hasValidPmtilesPackage } from "../src/storage/pmtilesGuard";
import { refreshLocationTrackingAccuracyIfRunning } from "../src/tracking/locationTracking";

void SplashScreen.preventAutoHideAsync();

/** Inclusive cutoff: app stops working from this instant onward. April 9, 2026, 12:00 AM IST. */
const APP_EXPIRES_AT = new Date("2026-05-09T00:00:00+05:30");

function useIsPastAppExpiry() {
  const [pastExpiry, setPastExpiry] = useState(
    () => Date.now() >= APP_EXPIRES_AT.getTime(),
  );
  useEffect(() => {
    const update = () => {
      setPastExpiry(Date.now() >= APP_EXPIRES_AT.getTime());
    };
    update();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        update();
      }
    });
    return () => sub.remove();
  }, []);
  return pastExpiry;
}

export default function RootLayout() {
  const pastExpiry = useIsPastAppExpiry();
  const router = useRouter();
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

  if (pastExpiry) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text style={{ fontSize: 16, textAlign: "center" }}>
            Contact the developer
          </Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={appNavigationTheme}>
        <RouteCapture />
        <AppErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: true,
              // Default `title` (not string `headerTitle`) so screens can override via setOptions({ title }).
              title: "MapMyTrip",
            }}
          />
        </AppErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
