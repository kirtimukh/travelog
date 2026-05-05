import Constants from "expo-constants";
import { AppState } from "react-native";
import * as Sentry from "@sentry/react-native";

const expoConfig = Constants.expoConfig;

// release + dist must match what the Expo plugin bakes into the native binary
// during EAS/release builds so Sentry can match uploaded source maps / dSYMs.
// These JS-derived values serve as a correct fallback for dev builds.
const iosBuild = expoConfig?.ios?.buildNumber;
const androidBuild = expoConfig?.android?.versionCode;
const dist = String(iosBuild ?? androidBuild ?? "1");
const release = `${expoConfig?.slug ?? "travelog"}@${expoConfig?.version ?? "0.0.1"}+${dist}`;

Sentry.init({
  dsn: "https://eff46c27b6e60956c5131033bfdfd281@o4511324709322752.ingest.de.sentry.io/4511324799893584",

  release,
  dist,

  // Captures MapLibre / GL / foreground-service native crashes alongside JS errors.
  enableNativeCrashHandling: true,

  // iOS: MetricKit-backed watchdog / OOM termination detection on next launch.
  enableWatchdogTerminationTracking: true,

  // Android ANR reports with richer context (all threads), not only the blocked thread.
  attachThreads: true,

  // Tracks session health (crash-free rate) in Sentry dashboards.
  enableAutoSessionTracking: true,

  // Default breadcrumbs cover fetch, XHR, console, and navigation automatically.
  // Additional AppState breadcrumbs are registered below.

  debug: __DEV__,
  // Disable in dev to avoid noise; flip to true to test the Sentry pipeline
  // against a dev build.
  enabled: !__DEV__,
});

// Explicit AppState breadcrumb so every crash report shows "last known
// foreground state" (active / background / inactive).
AppState.addEventListener("change", (nextState) => {
  Sentry.addBreadcrumb({
    category: "app.lifecycle",
    message: `AppState → ${nextState}`,
    level: nextState === "active" ? "info" : "warning",
    data: { state: nextState },
  });
});
