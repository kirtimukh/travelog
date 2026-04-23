import * as Location from "expo-location";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { onPermissionGranted } from "../../../location/currentLocationCache";
import { openAppDatabase } from "../../../db/client";
import {
  createWeather,
  deleteWeatherById,
  insertWeatherQuotaEvent,
  listRecentWeatherQuotaEventTimestamps,
} from "../../../db/weather";
import type { WeatherRow } from "../../../db/schema";
import { cacheWeatherIcon, lookupCurrentConditions } from "../../../weather";
import {
  weatherRowToCardDisplay,
  type JourneyWeatherCardDisplay,
} from "../components/JourneyWeatherCardBody";
import { computeWeatherCallsLeft, QUOTA_MAX_CALLS, QUOTA_WINDOW_MS } from "../weatherQuota";

const GOOGLE_WEATHER_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_WEATHER_API_KEY;

export type WeatherCaptureModalMode = "captureIdle" | "capturePreview" | "viewExisting";

type PreviewPayload = {
  temperature: number | null;
  feelsLikeTemperature: number | null;
  weatherCondition: string | null;
  weatherConditionIcon: string | null;
  fullData: string;
  timestamp: number;
  lat: number;
  lng: number;
};

function previewToDisplay(p: PreviewPayload): JourneyWeatherCardDisplay {
  return {
    timestamp: p.timestamp,
    lat: p.lat,
    lng: p.lng,
    weather_condition: p.weatherCondition,
    weather_condition_icon: p.weatherConditionIcon,
    temperature: p.temperature,
    feels_like_temperature: p.feelsLikeTemperature,
  };
}

type Params = {
  journeyId: number;
  refreshJourneyData: () => Promise<void>;
};

export type UseWeatherCaptureFlowResult = {
  modal: {
    visible: boolean;
    mode: WeatherCaptureModalMode;
    busy: boolean;
    offline: boolean;
    error: string | null;
    callsLeft: number;
    quotaLabel: string;
    canRequest: boolean;
    weatherDisplay: JourneyWeatherCardDisplay | null;
    dismissButtonLabel: "Close" | "Discard";
    open: () => void;
    openForWeather: (row: WeatherRow) => void;
    close: () => void;
    retryAvailability: () => Promise<void>;
    requestWeather: () => Promise<void>;
    savePreview: () => Promise<void>;
    requestDeleteWeather: () => void;
  };
};

export function useWeatherCaptureFlow({
  journeyId,
  refreshJourneyData,
}: Params): UseWeatherCaptureFlowResult {
  /** Incremented on `close` so in-flight fetches ignore UI after dismiss. */
  const captureGenerationRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callsLeft, setCallsLeft] = useState(QUOTA_MAX_CALLS);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [viewRow, setViewRow] = useState<WeatherRow | null>(null);

  const refreshAvailability = useCallback(async (): Promise<void> => {
    const netState = await NetInfo.fetch();
    const online = Boolean(netState.isConnected) && netState.isInternetReachable !== false;
    setOffline(!online);

    const now = Date.now();
    const db = await openAppDatabase();
    const timestamps = await listRecentWeatherQuotaEventTimestamps(db, now - QUOTA_WINDOW_MS);
    setCallsLeft(computeWeatherCallsLeft(timestamps, now));
  }, []);

  const resetInnerState = useCallback(() => {
    setBusy(false);
    setError(null);
    setPreview(null);
    setViewRow(null);
  }, []);

  const open = useCallback(() => {
    setVisible(true);
    setPreview(null);
    setViewRow(null);
    setError(null);
    void refreshAvailability();
  }, [refreshAvailability]);

  const close = useCallback(() => {
    captureGenerationRef.current += 1;
    setVisible(false);
    resetInnerState();
  }, [resetInnerState]);

  const openForWeather = useCallback(
    (row: WeatherRow) => {
      setVisible(true);
      setViewRow(row);
      setPreview(null);
      setError(null);
      void refreshAvailability();
    },
    [refreshAvailability],
  );

  const retryAvailability = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await refreshAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify connectivity.");
    } finally {
      setBusy(false);
    }
  }, [refreshAvailability]);

  const requestWeather = useCallback(async (): Promise<void> => {
    if (busy || preview !== null || viewRow !== null) {
      return;
    }
    const generationAtStart = captureGenerationRef.current;
    setBusy(true);
    setError(null);

    try {
      const now = Date.now();
      const netState = await NetInfo.fetch();
      const online = Boolean(netState.isConnected) && netState.isInternetReachable !== false;
      if (!online) {
        setOffline(true);
        return;
      }
      setOffline(false);

      const db = await openAppDatabase();
      const quotaTimestamps = await listRecentWeatherQuotaEventTimestamps(db, now - QUOTA_WINDOW_MS);
      const updatedCallsLeft = computeWeatherCallsLeft(quotaTimestamps, now);
      setCallsLeft(updatedCallsLeft);
      if (updatedCallsLeft < 1) {
        return;
      }

      if (!GOOGLE_WEATHER_API_KEY?.trim()) {
        throw new Error("Google Weather API key is missing.");
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        throw new Error("Location permission is required to fetch weather.");
      }
      const coords = await onPermissionGranted();
      if (!coords) {
        throw new Error("Could not get current location.");
      }
      const timestamp = Date.now();
      const lat = coords.lat;
      const lng = coords.lng;
      const response = await lookupCurrentConditions({
        apiKey: GOOGLE_WEATHER_API_KEY,
        latitude: lat,
        longitude: lng,
      });

      const iconBaseUri = response.weatherCondition?.iconBaseUri ?? "";
      const weatherConditionIcon = iconBaseUri ? await cacheWeatherIcon(iconBaseUri) : null;
      const weatherCondition =
        response.weatherCondition?.description?.text ?? response.weatherCondition?.type ?? null;

      await insertWeatherQuotaEvent(db, timestamp);

      const afterQuota = await listRecentWeatherQuotaEventTimestamps(db, Date.now() - QUOTA_WINDOW_MS);
      setCallsLeft(computeWeatherCallsLeft(afterQuota, Date.now()));

      if (captureGenerationRef.current !== generationAtStart) {
        return;
      }

      setPreview({
        temperature: response.temperature?.degrees ?? null,
        feelsLikeTemperature: response.feelsLikeTemperature?.degrees ?? null,
        weatherCondition,
        weatherConditionIcon,
        fullData: JSON.stringify(response),
        timestamp,
        lat,
        lng,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch weather conditions.");
    } finally {
      setBusy(false);
    }
  }, [busy, preview, viewRow]);

  const savePreview = useCallback(async (): Promise<void> => {
    if (busy || !preview) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const db = await openAppDatabase();
      await createWeather(db, {
        journeyId,
        temperature: preview.temperature,
        feelsLikeTemperature: preview.feelsLikeTemperature,
        weatherCondition: preview.weatherCondition,
        weatherConditionIcon: preview.weatherConditionIcon,
        fullData: preview.fullData,
        timestamp: preview.timestamp,
        lat: preview.lat,
        lng: preview.lng,
      });
      await refreshJourneyData();
      await refreshAvailability();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save weather.");
    } finally {
      setBusy(false);
    }
  }, [busy, close, journeyId, preview, refreshAvailability, refreshJourneyData]);

  const runDelete = useCallback(async (): Promise<void> => {
    if (!viewRow) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const db = await openAppDatabase();
      await deleteWeatherById(db, journeyId, viewRow.id);
      await refreshJourneyData();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete weather.");
    } finally {
      setBusy(false);
    }
  }, [close, journeyId, refreshJourneyData, viewRow]);

  const requestDeleteWeather = useCallback((): void => {
    if (!viewRow || busy) {
      return;
    }
    Alert.alert(
      "Delete weather?",
      "This weather snapshot will be removed from the journey.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void runDelete() },
      ],
    );
  }, [busy, runDelete, viewRow]);

  const mode: WeatherCaptureModalMode = useMemo(() => {
    if (viewRow) {
      return "viewExisting";
    }
    if (preview) {
      return "capturePreview";
    }
    return "captureIdle";
  }, [preview, viewRow]);

  const weatherDisplay = useMemo((): JourneyWeatherCardDisplay | null => {
    if (viewRow) {
      return weatherRowToCardDisplay(viewRow);
    }
    if (preview) {
      return previewToDisplay(preview);
    }
    return null;
  }, [preview, viewRow]);

  const dismissButtonLabel: "Close" | "Discard" = preview ? "Discard" : "Close";

  const quotaLabel = useMemo(
    () => `Only 2 calls allowed within a span of 15 minutes. ${callsLeft} calls left`,
    [callsLeft],
  );

  const canRequest = !busy && !offline && callsLeft > 0 && preview === null && viewRow === null;

  return {
    modal: {
      visible,
      mode,
      busy,
      offline,
      error,
      callsLeft,
      quotaLabel,
      canRequest,
      weatherDisplay,
      dismissButtonLabel,
      open,
      openForWeather,
      close,
      retryAvailability,
      requestWeather,
      savePreview,
      requestDeleteWeather,
    },
  };
}
