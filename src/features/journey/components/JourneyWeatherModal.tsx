import { Modal, Pressable, Text, View } from "react-native";

import type { WeatherCaptureModalMode } from "../hooks/useWeatherCaptureFlow";
import { JourneyWeatherCardBody, type JourneyWeatherCardDisplay } from "./JourneyWeatherCardBody";

type Props = {
  visible: boolean;
  mode: WeatherCaptureModalMode;
  busy: boolean;
  offline: boolean;
  error: string | null;
  quotaLabel: string;
  canRequest: boolean;
  weatherDisplay: JourneyWeatherCardDisplay | null;
  dismissButtonLabel: "Close" | "Discard";
  onRetry: () => void;
  onRequestWeather: () => void;
  onDismiss: () => void;
  onSave?: () => void;
  onDelete?: () => void;
};

export function JourneyWeatherModal({
  visible,
  mode,
  busy,
  offline,
  error,
  quotaLabel,
  canRequest,
  weatherDisplay,
  dismissButtonLabel,
  onRetry,
  onRequestWeather,
  onDismiss,
  onSave,
  onDelete,
}: Props) {
  const showQuota = mode === "captureIdle";
  const showGet = mode === "captureIdle" && !offline;
  const showPreviewCard = mode === "capturePreview" || mode === "viewExisting";
  const showSave = mode === "capturePreview" && onSave;
  const showDelete = mode === "viewExisting" && onDelete;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View className="flex-1">
        <Pressable className="absolute inset-0 bg-black/50" onPress={onDismiss} />
        <View className="flex-1 items-center justify-center px-4" pointerEvents="box-none">
          <View className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-4 shadow">
            <Text className="text-lg font-semibold text-neutral-900">Weather conditions</Text>

            {showQuota ? (
              offline ? (
                <Text className="mt-2 text-sm text-neutral-700">
                  Internet connection is required to fetch weather conditions.
                </Text>
              ) : (
                <Text className="mt-2 text-sm text-neutral-700">{quotaLabel}</Text>
              )
            ) : null}

            {error ? <Text className="mt-2 text-sm text-red-700">{error}</Text> : null}

            {showPreviewCard && weatherDisplay ? (
              <JourneyWeatherCardBody data={weatherDisplay} includeTopMargin />
            ) : null}

            {offline && mode === "captureIdle" ? (
              <Pressable
                className={`mt-4 rounded-md px-4 py-3 ${busy ? "bg-neutral-300" : "bg-blue-600"}`}
                disabled={busy}
                onPress={onRetry}
              >
                <Text className="text-center font-semibold text-white">
                  {busy ? "Checking..." : "Retry"}
                </Text>
              </Pressable>
            ) : null}

            {showGet ? (
              <Pressable
                className={`mt-4 rounded-md px-4 py-3 ${canRequest ? "bg-emerald-600" : "bg-neutral-300"}`}
                disabled={!canRequest}
                onPress={onRequestWeather}
              >
                <Text className="text-center font-semibold text-white">
                  {busy ? "Fetching..." : "Get weather conditions"}
                </Text>
              </Pressable>
            ) : null}

            {showSave ? (
              <Pressable
                className={`mt-4 rounded-md px-4 py-3 ${busy ? "bg-neutral-300" : "bg-emerald-600"}`}
                disabled={busy}
                onPress={onSave}
              >
                <Text className="text-center font-semibold text-white">
                  {busy ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            ) : null}

            {showDelete ? (
              <Pressable
                className={`mt-4 rounded-md px-4 py-3 ${busy ? "bg-neutral-300" : "bg-red-600"}`}
                disabled={busy}
                onPress={onDelete}
              >
                <Text className="text-center font-semibold text-white">
                  {busy ? "Deleting..." : "Delete"}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              className="mt-2 rounded-md border border-neutral-300 bg-white px-4 py-3"
              disabled={busy && (mode === "capturePreview" || mode === "viewExisting")}
              onPress={onDismiss}
            >
              <Text className="text-center font-semibold text-neutral-800">{dismissButtonLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
