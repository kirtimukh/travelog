import { useAudioRecorderState } from "expo-audio";
import { Text, View } from "react-native";

import type { VoiceRecorder } from "../../../files/voiceRecording";
import { formatDurationSeconds } from "../formatDuration";

type Props = {
  recorder: VoiceRecorder;
};

export function VoiceNoteRecorderElapsed({ recorder }: Props) {
  const state = useAudioRecorderState(recorder, 250);
  const elapsed = formatDurationSeconds(state.durationMillis / 1000);
  return (
    <View className="mt-2">
      <Text className="text-center text-sm text-neutral-600">Recording · {elapsed}</Text>
    </View>
  );
}
