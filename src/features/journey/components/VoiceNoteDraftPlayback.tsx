import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect } from "react";
import { Pressable, Text, View } from "react-native";

import { formatDurationSeconds } from "../formatDuration";

type Props = {
  uri: string;
  busy: boolean;
};

export function VoiceNoteDraftPlayback({ uri, busy }: Props) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    return () => {
      player.pause();
    };
  }, [player, uri]);

  const togglePlayback = useCallback(async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    const nearEnd =
      status.didJustFinish ||
      (status.duration > 0 && status.currentTime >= status.duration - 0.05);
    if (nearEnd) {
      await player.seekTo(0);
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    player.play();
  }, [
    player,
    status.currentTime,
    status.didJustFinish,
    status.duration,
    status.playing,
  ]);

  const totalLabel = status.duration > 0 ? formatDurationSeconds(status.duration) : "—:—";
  const currentLabel = formatDurationSeconds(status.currentTime);

  return (
    <View className="mt-3">
      <Text className="text-center text-sm tabular-nums text-neutral-700">
        {currentLabel} / {totalLabel}
      </Text>
      <Pressable
        className={`mt-2 rounded-md px-3 py-2 ${busy || !status.isLoaded ? "bg-neutral-300" : "bg-neutral-700"}`}
        disabled={busy || !status.isLoaded}
        onPress={() => {
          void togglePlayback();
        }}
      >
        <Text className="text-center font-semibold text-white">
          {status.playing ? "Pause preview" : "Play preview"}
        </Text>
      </Pressable>
    </View>
  );
}
