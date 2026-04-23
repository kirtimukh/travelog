import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { enterPlaybackSession, registerPlayer } from "../../../audio/audioSessionManager";

import { formatDurationSeconds } from "../formatDuration";

type Props = {
  uri: string;
  busy: boolean;
  /** From finalize step; shown as total until player metadata loads. */
  totalSecondsHint?: number;
  playLabel?: string;
  pauseLabel?: string;
};

/**
 * Preview playback for a pending voice file before DB save (dedicated player; session already
 * switched to playback mode after finalize per voice_note_brd.md).
 */
export function VoiceNoteDraftPlayback({
  uri,
  busy,
  totalSecondsHint,
  playLabel = "Play preview",
  pauseLabel = "Pause preview",
}: Props) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    console.log("VoiceNoteDraftPlayback:useEffect", { uri, playerId: player.id });
    setLoadError(null);
  }, [player.id, uri]);

  useEffect(() => {
    return registerPlayer(player);
  }, [player]);

  const togglePlayback = useCallback(async () => {
    setLoadError(null);
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
    await enterPlaybackSession();
    try {
      player.play();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Playback failed");
    }
  }, [
    player,
    status.currentTime,
    status.didJustFinish,
    status.duration,
    status.playing,
  ]);

  const totalSeconds =
    status.duration > 0
      ? status.duration
      : totalSecondsHint != null
        ? totalSecondsHint
        : 0;
  const totalLabel = totalSeconds > 0 ? formatDurationSeconds(totalSeconds) : "—:—";
  const currentLabel = formatDurationSeconds(status.currentTime);

  return (
    <View className="mt-3">
      <Text className="text-center text-sm tabular-nums text-neutral-700">
        {currentLabel} / {totalLabel}
      </Text>
      {loadError ? (
        <Text className="mt-1 text-center text-xs text-red-600">{loadError}</Text>
      ) : null}
      <Pressable
        className={`mt-2 rounded-md px-3 py-2 ${busy ? "bg-neutral-300" : "bg-neutral-700"}`}
        disabled={busy}
        onPress={() => {
          void togglePlayback();
        }}
      >
        <Text className="text-center font-semibold text-white">
          {status.playing ? pauseLabel : playLabel}
        </Text>
      </Pressable>
    </View>
  );
}
