import { Text, View } from "react-native";

import { formatDurationSeconds } from "../../formatDuration";

type Props = {
  replayTs: number | null;
  journeyDurationMs: number;
  replayDurationMs: number;
  recordedDistanceMeters: number;
  speed: number | null;
  heading: number | null;
};

export function JourneyDetailsReplayStatsCard({
  replayTs,
  journeyDurationMs,
  replayDurationMs,
  recordedDistanceMeters,
  speed,
  heading,
}: Props) {
  return (
    <View className="mt-3 rounded-xl border border-neutral-200 p-3">
      <Text className="text-xs text-neutral-700">
        Timestamp:{" "}
        {replayTs == null
          ? "—"
          : new Date(replayTs).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "medium",
            })}
      </Text>
      <Text className="mt-1 text-xs text-neutral-700">
        Journey duration:{" "}
        {journeyDurationMs <= 0 ? "—" : formatDurationSeconds(journeyDurationMs / 1000)}
      </Text>
      <Text className="mt-1 text-xs text-neutral-700">
        Recorded duration:{" "}
        {replayDurationMs <= 0 ? "—" : formatDurationSeconds(replayDurationMs / 1000)}
      </Text>
      <Text className="mt-1 text-xs text-neutral-700">
        Recorded distance:{" "}
        {recordedDistanceMeters <= 0
          ? "—"
          : `${(recordedDistanceMeters / 1000).toFixed(2)} km`}
      </Text>
      <Text className="mt-1 text-xs text-neutral-700">
        Speed: {speed == null ? "—" : `${(speed * 3.6).toFixed(2)} km/h`}
      </Text>
      <Text className="mt-1 text-xs text-neutral-700">
        Heading: {heading == null ? "—" : `${heading.toFixed(2)} deg`}
      </Text>
    </View>
  );
}
