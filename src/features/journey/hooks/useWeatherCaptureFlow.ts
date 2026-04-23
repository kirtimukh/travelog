import * as Location from "expo-location";
import { useCallback, useMemo, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

import { onPermissionGranted } from "../../../location/currentLocationCache";
import { openAppDatabase } from "../../../db/client";
import { createWeather, listRecentWeatherRequests } from "../../../db/weather";
import { cacheWeatherIcon, lookupCurrentConditions } from "../../../weather";
import { computeWeatherCallsLeft, QUOTA_MAX_CALLS, QUOTA_WINDOW_MS } from "../weatherQuota";

const GOOGLE_WEATHER_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_WEATHER_API_KEY;

type Params = {
  journeyId: number;
  refreshJourneyData: () => Promise<void>;
};

export type UseWeatherCaptureFlowResult = {
  modal: {
    visible: boolean;
    busy: boolean;
    offline: boolean;
    error: string | null;
    success: string | null;
    callsLeft: number;
    quotaLabel: string;
    canRequest: boolean;
    open: () => void;
    close: () => void;
    retryAvailability: () => Promise<void>;
    requestWeather: () => Promise<void>;
  };
};

export function useWeatherCaptureFlow({
  journeyId,
  refreshJourneyData,
}: Params): UseWeatherCaptureFlowResult {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [callsLeft, setCallsLeft] = useState(QUOTA_MAX_CALLS);

  const refreshAvailability = useCallback(async (): Promise<void> => {
    const netState = await NetInfo.fetch();
    const online = Boolean(netState.isConnected) && netState.isInternetReachable !== false;
    setOffline(!online);

    const now = Date.now();
    const db = await openAppDatabase();
    const rows = await listRecentWeatherRequests(db, now - QUOTA_WINDOW_MS);
    setCallsLeft(computeWeatherCallsLeft(rows.map((row) => row.timestamp), now));
  }, []);

  const open = useCallback(() => {
    setVisible(true);
    setSuccess(null);
    setError(null);
    void refreshAvailability();
  }, [refreshAvailability]);

  const close = useCallback(() => {
    setVisible(false);
    setBusy(false);
    setError(null);
    setSuccess(null);
  }, []);

  const retryAvailability = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await refreshAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify connectivity.");
    } finally {
      setBusy(false);
    }
  }, [refreshAvailability]);

  const requestWeather = useCallback(async (): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);

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
      const quotaRows = await listRecentWeatherRequests(db, now - QUOTA_WINDOW_MS);
      const updatedCallsLeft = computeWeatherCallsLeft(
        quotaRows.map((row) => row.timestamp),
        now,
      );
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
      await createWeather(db, {
        journeyId,
        temperature: response.temperature?.degrees ?? null,
        feelsLikeTemperature: response.feelsLikeTemperature?.degrees ?? null,
        weatherCondition,
        weatherConditionIcon,
        fullData: JSON.stringify(response),
        timestamp,
        lat,
        lng,
      });

      await refreshJourneyData();
      await refreshAvailability();
      setSuccess("Weather conditions saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch weather conditions.");
    } finally {
      setBusy(false);
    }
  }, [busy, journeyId, refreshAvailability, refreshJourneyData]);

  const quotaLabel = useMemo(
    () => `Only 2 calls allowed within a span of 15 minutes. ${callsLeft} calls left`,
    [callsLeft],
  );
  const canRequest = !busy && !offline && callsLeft > 0;

  return {
    modal: {
      visible,
      busy,
      offline,
      error,
      success,
      callsLeft,
      quotaLabel,
      canRequest,
      open,
      close,
      retryAvailability,
      requestWeather,
    },
  };
}
