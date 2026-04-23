import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { VoiceRecorder } from "../../../files/voiceRecording";
import { VoiceNoteRecorderElapsed } from "./VoiceNoteRecorderElapsed";

type Props = {
  recorder: VoiceRecorder;
  busy: boolean;
  onStop: () => void;
};

export function RerecordOverlayBar({ recorder, busy, onStop }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-t border-neutral-200 bg-white px-4 pt-3 shadow-md"
      style={{ paddingBottom: Math.max(insets.bottom + 12, 20) }}
    >
      <Text className="text-center text-sm font-semibold text-neutral-900">
        Re-recording voice note
      </Text>
      <VoiceNoteRecorderElapsed recorder={recorder} />
      <Pressable
        className={`mt-2 rounded-md px-4 py-3 ${busy ? "bg-neutral-300" : "bg-red-600"}`}
        disabled={busy}
        onPress={onStop}
      >
        <Text className="text-center font-semibold text-white">
          {busy ? "Working…" : "Stop and save"}
        </Text>
      </Pressable>
    </View>
  );
}
