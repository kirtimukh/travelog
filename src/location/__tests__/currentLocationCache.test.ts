const store = new Map<string, string>();

const mockGetString = jest.fn((key: string) => store.get(key));
const mockSet = jest.fn((key: string, value: string) => {
  store.set(key, value);
});
const mockRemove = jest.fn((key: string) => {
  store.delete(key);
});

jest.mock("../../storage/mmkv", () => ({
  getAppStorage: () => ({
    getString: mockGetString,
    set: mockSet,
    remove: mockRemove,
  }),
}));

const mockGetForegroundPermissionsAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockHasStartedLocationUpdatesAsync = jest.fn();
const mockWatchPositionAsync = jest.fn();
const mockWatchRemove = jest.fn();

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 4 },
  PermissionStatus: { GRANTED: "granted", DENIED: "denied" },
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissionsAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetCurrentPositionAsync(...args),
  hasStartedLocationUpdatesAsync: (...args: unknown[]) =>
    mockHasStartedLocationUpdatesAsync(...args),
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
}));

const mockAppStateGetCurrent = jest.fn(() => "active");
jest.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return mockAppStateGetCurrent();
    },
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

import * as Location from "expo-location";

import {
  CACHE_STALE_MS,
  bootstrapCurrentLocationCache,
  getCachedCurrentLocation,
  mergeWithCachedGps,
  reconcileForegroundWatch,
  refreshCachedCurrentLocation,
  subscribeCurrentLocationCacheAppState,
  writeCurrentLocationFromCoords,
} from "../currentLocationCache";
import { LOCATION_TASK_NAME } from "../../tracking/constants";

describe("currentLocationCache", () => {
  beforeEach(() => {
    store.clear();
    mockGetString.mockClear();
    mockSet.mockClear();
    mockRemove.mockClear();
    mockGetForegroundPermissionsAsync.mockReset();
    mockGetCurrentPositionAsync.mockReset();
    mockHasStartedLocationUpdatesAsync.mockReset();
    mockWatchPositionAsync.mockReset();
    mockWatchRemove.mockReset();
    mockAppStateGetCurrent.mockReturnValue("active");
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    });
    mockHasStartedLocationUpdatesAsync.mockResolvedValue(false);
    mockWatchPositionAsync.mockResolvedValue({ remove: mockWatchRemove });
  });

  it("round-trips coordinates via MMKV", () => {
    writeCurrentLocationFromCoords(37.7, -122.4, 1_700_000_000_000);
    expect(getCachedCurrentLocation()).toEqual({
      lat: 37.7,
      lng: -122.4,
      fetchedAtMs: 1_700_000_000_000,
    });
  });

  it("returns null when persisted values are incomplete", () => {
    store.set("cachedCurrentLocationLat", "1");
    expect(getCachedCurrentLocation()).toBeNull();
  });

  it("mergeWithCachedGps prefers EXIF and fills missing axes from cache", () => {
    expect(
      mergeWithCachedGps({
        exifLat: 10,
        exifLng: null,
        cache: { lat: 99, lng: 20, fetchedAtMs: 0 },
      }),
    ).toEqual({ lat: 10, lng: 20 });

    expect(
      mergeWithCachedGps({
        exifLat: null,
        exifLng: 30,
        cache: { lat: 40, lng: 50, fetchedAtMs: 0 },
      }),
    ).toEqual({ lat: 40, lng: 30 });

    expect(
      mergeWithCachedGps({
        exifLat: 1,
        exifLng: 2,
        cache: { lat: 99, lng: 99, fetchedAtMs: 0 },
      }),
    ).toEqual({ lat: 1, lng: 2 });
  });

  it("mergeWithCachedGps returns nulls when no EXIF and no cache", () => {
    expect(
      mergeWithCachedGps({ exifLat: null, exifLng: null, cache: null }),
    ).toEqual({ lat: null, lng: null });
  });

  it("refreshCachedCurrentLocation persists GPS read", async () => {
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 1.5, longitude: 2.5 },
      timestamp: 5_000,
    });
    const result = await refreshCachedCurrentLocation();
    expect(result).toEqual({ lat: 1.5, lng: 2.5, fetchedAtMs: 5_000 });
    expect(getCachedCurrentLocation()).toEqual(result);
  });

  it("refreshCachedCurrentLocation returns null without foreground permission", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.DENIED,
    });
    expect(await refreshCachedCurrentLocation()).toBeNull();
    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("bootstrap refreshes when cache is stale", async () => {
    writeCurrentLocationFromCoords(0, 0, Date.now() - CACHE_STALE_MS - 1);
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 3, longitude: 4 },
      timestamp: 9_000,
    });
    await bootstrapCurrentLocationCache();
    expect(mockGetCurrentPositionAsync).toHaveBeenCalled();
    expect(getCachedCurrentLocation()?.lat).toBe(3);
  });

  it("bootstrap skips GPS refresh when cache is fresh", async () => {
    writeCurrentLocationFromCoords(1, 2, Date.now());
    await bootstrapCurrentLocationCache();
    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("reconcileForegroundWatch does not start watch when background updates are running", async () => {
    mockHasStartedLocationUpdatesAsync.mockImplementation(async (name: string) => {
      expect(name).toBe(LOCATION_TASK_NAME);
      return true;
    });
    await reconcileForegroundWatch();
    expect(mockWatchPositionAsync).not.toHaveBeenCalled();
  });

  it("subscribeCurrentLocationCacheAppState returns an unsubscribe", () => {
    const unsub = subscribeCurrentLocationCacheAppState();
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
