import * as Location from "expo-location";
import { AppState, type AppStateStatus } from "react-native";

import { getAppStorage } from "../storage/mmkv";
import { LOCATION_TASK_NAME } from "../tracking/constants";

const KEY_LAT = "cachedCurrentLocationLat";
const KEY_LNG = "cachedCurrentLocationLng";
const KEY_AT = "cachedCurrentLocationAt";

/** PRD: treat cache as stale after this many ms (bootstrap refresh). */
export const CACHE_STALE_MS = 5 * 60 * 1000;

export type CachedCurrentLocation = {
  lat: number;
  lng: number;
  fetchedAtMs: number;
};

type CurrentLocationListener = (coords: CachedCurrentLocation) => void;
const currentLocationListeners = new Set<CurrentLocationListener>();

function readNumber(key: string): number | null {
  try {
    const s = getAppStorage().getString(key);
    if (s == null || s === "") {
      return null;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function getCachedCurrentLocation(): CachedCurrentLocation | null {
  const lat = readNumber(KEY_LAT);
  const lng = readNumber(KEY_LNG);
  const fetchedAtMs = readNumber(KEY_AT);
  if (lat == null || lng == null || fetchedAtMs == null) {
    return null;
  }
  return { lat, lng, fetchedAtMs };
}

export function writeCurrentLocationFromCoords(
  lat: number,
  lng: number,
  fetchedAtMs?: number,
): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }
  const ts = fetchedAtMs ?? Date.now();
  if (!Number.isFinite(ts)) {
    return;
  }
  try {
    const storage = getAppStorage();
    storage.set(KEY_LAT, String(lat));
    storage.set(KEY_LNG, String(lng));
    storage.set(KEY_AT, String(ts));
    const coords = { lat, lng, fetchedAtMs: ts };
    currentLocationListeners.forEach((listener) => {
      listener(coords);
    });
  } catch {
    // MMKV unavailable (e.g. some test envs) — ignore
  }
}

export function subscribeCachedCurrentLocation(
  listener: CurrentLocationListener,
): () => void {
  currentLocationListeners.add(listener);
  return () => {
    currentLocationListeners.delete(listener);
  };
}

export async function refreshCachedCurrentLocation(): Promise<CachedCurrentLocation | null> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    return null;
  }
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const fetchedAtMs = position.timestamp ?? Date.now();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    writeCurrentLocationFromCoords(lat, lng, fetchedAtMs);
    return { lat, lng, fetchedAtMs };
  } catch {
    return null;
  }
}

let watchSubscription: Location.LocationSubscription | null = null;
let reconcileChain: Promise<void> = Promise.resolve();

async function stopWatch(): Promise<void> {
  if (watchSubscription) {
    watchSubscription.remove();
    watchSubscription = null;
  }
}

async function reconcileForegroundWatchInner(): Promise<void> {
  if (AppState.currentState !== "active") {
    await stopWatch();
    return;
  }

  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    await stopWatch();
    return;
  }

  const bgRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (bgRunning) {
    await stopWatch();
    return;
  }

  if (watchSubscription) {
    return;
  }

  try {
    watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10,
        timeInterval: 5000,
      },
      (loc) => {
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;
        const ts = loc.timestamp ?? Date.now();
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          writeCurrentLocationFromCoords(lat, lng, ts);
        }
      },
    );
  } catch {
    watchSubscription = null;
  }
}

/**
 * Starts or stops foreground watch so it only runs when app is active,
 * permission is granted, and background journey tracking is not using LOCATION_TASK_NAME.
 */
export function reconcileForegroundWatch(): Promise<void> {
  reconcileChain = reconcileChain
    .then(() => reconcileForegroundWatchInner())
    .catch(() => {});
  return reconcileChain;
}

/** Refresh cache, reconcile watch; returns the fresh fix (or null) so callers can avoid a second GPS read. */
export async function onPermissionGranted(): Promise<CachedCurrentLocation | null> {
  const coords = await refreshCachedCurrentLocation();
  await reconcileForegroundWatch();
  return coords;
}

export async function bootstrapCurrentLocationCache(): Promise<void> {
  if (AppState.currentState !== "active") {
    return;
  }
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    return;
  }
  const c = getCachedCurrentLocation();
  const stale = !c || Date.now() - c.fetchedAtMs > CACHE_STALE_MS;
  if (stale) {
    await refreshCachedCurrentLocation();
  }
  await reconcileForegroundWatch();
}

export type MergeGpsInput = {
  exifLat: number | null;
  exifLng: number | null;
  cache: CachedCurrentLocation | null;
};

/** Per-axis merge: EXIF wins when present; otherwise use cache. */
export function mergeWithCachedGps({
  exifLat,
  exifLng,
  cache,
}: MergeGpsInput): { lat: number | null; lng: number | null } {
  return {
    lat: exifLat ?? cache?.lat ?? null,
    lng: exifLng ?? cache?.lng ?? null,
  };
}

function handleAppState(next: AppStateStatus): void {
  if (next !== "active") {
    void stopWatch();
  } else {
    void bootstrapCurrentLocationCache();
  }
}

/** Subscribe from root layout: runs bootstrap once, then on each `active` transition. Cleanup stops the watch. */
export function subscribeCurrentLocationCacheAppState(): () => void {
  void bootstrapCurrentLocationCache();
  const sub = AppState.addEventListener("change", handleAppState);
  return () => {
    sub.remove();
    void stopWatch();
  };
}
