import { Modal, Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  busy: boolean;
  offline: boolean;
  error: string | null;
  success: string | null;
  quotaLabel: string;
  canRequest: boolean;
  onRetry: () => void;
  onRequestWeather: () => void;
  onClose: () => void;
};

export function JourneyWeatherModal({
  visible,
  busy,
  offline,
  error,
  success,
  quotaLabel,
  canRequest,
  onRetry,
  onRequestWeather,
  onClose,
}: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1">
        <Pressable className="absolute inset-0 bg-black/50" onPress={onClose} />
        <View className="flex-1 items-center justify-center px-4" pointerEvents="box-none">
          <View className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-4 shadow">
            <Text className="text-lg font-semibold text-neutral-900">Weather conditions</Text>

            {offline ? (
              <Text className="mt-2 text-sm text-neutral-700">
                Internet connection is required to fetch weather conditions.
              </Text>
            ) : (
              <Text className="mt-2 text-sm text-neutral-700">{quotaLabel}</Text>
            )}

            {error ? <Text className="mt-2 text-sm text-red-700">{error}</Text> : null}
            {success ? <Text className="mt-2 text-sm text-emerald-700">{success}</Text> : null}

            {offline ? (
              <Pressable
                className={`mt-4 rounded-md px-4 py-3 ${busy ? "bg-neutral-300" : "bg-blue-600"}`}
                disabled={busy}
                onPress={onRetry}
              >
                <Text className="text-center font-semibold text-white">
                  {busy ? "Checking..." : "Retry"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                className={`mt-4 rounded-md px-4 py-3 ${canRequest ? "bg-emerald-600" : "bg-neutral-300"}`}
                disabled={!canRequest}
                onPress={onRequestWeather}
              >
                <Text className="text-center font-semibold text-white">
                  {busy ? "Fetching..." : "Get weather conditions"}
                </Text>
              </Pressable>
            )}

            <Pressable
              className="mt-2 rounded-md border border-neutral-300 bg-white px-4 py-3"
              onPress={onClose}
            >
              <Text className="text-center font-semibold text-neutral-800">Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
