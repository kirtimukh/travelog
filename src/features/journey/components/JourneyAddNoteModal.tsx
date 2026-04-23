import { Keyboard, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { VoiceRecorder } from "../../../files/voiceRecording";
import { useModalKeyboardInset } from "../hooks/useModalKeyboardInset";
import { VoiceNoteDraftPlayback } from "./VoiceNoteDraftPlayback";
import { VoiceNoteRecorderElapsed } from "./VoiceNoteRecorderElapsed";

export type AddNoteModalMode = "text" | "voice";

type VoiceNoteDraft = {
  uri: string;
  durationSeconds: number;
};

type Props = {
  visible: boolean;
  mode: AddNoteModalMode;
  newNoteText: string;
  newAudioRecorder: VoiceRecorder | null;
  newAudioDraft: VoiceNoteDraft | null;
  busy: boolean;
  onClose: () => void;
  onChangeNewNoteText: (text: string) => void;
  onAddTextNote: () => void;
  onStartVoiceRecording: () => void;
  onStopVoiceRecording: () => void;
  onSaveVoiceNote: () => void;
  onDiscardVoiceRecording: () => void;
};

export function JourneyAddNoteModal({
  visible,
  mode,
  newNoteText,
  newAudioRecorder,
  newAudioDraft,
  busy,
  onClose,
  onChangeNewNoteText,
  onAddTextNote,
  onStartVoiceRecording,
  onStopVoiceRecording,
  onSaveVoiceNote,
  onDiscardVoiceRecording,
}: Props) {
  const insets = useSafeAreaInsets();
  const modalPaddingBottom = Math.max(insets.bottom + 16, 32);
  const modalKeyboardInset = useModalKeyboardInset();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/50"
            onPress={() => {
              Keyboard.dismiss();
              onClose();
            }}
          />
          <View
            className="rounded-t-2xl border-t border-neutral-200 bg-white px-4 pt-4"
            style={{
              paddingBottom: modalPaddingBottom,
              transform: [{ translateY: -modalKeyboardInset }],
            }}
          >
            <Text className="text-base font-semibold text-neutral-900">
              {mode === "voice" ? "Add voice note" : "Add note"}
            </Text>
            {mode === "text" ? (
              <>
                <TextInput
                  className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Note text"
                  value={newNoteText}
                  onChangeText={onChangeNewNoteText}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={{ minHeight: 84 }}
                />
                <Pressable
                  className="mt-3 rounded-md bg-blue-600 px-4 py-2"
                  disabled={busy}
                  onPress={onAddTextNote}
                >
                  <Text className="text-center font-semibold text-white">Save</Text>
                </Pressable>
              </>
            ) : (
              <>
                {newAudioRecorder ? (
                  <>
                    <Pressable
                      className="mt-3 rounded-md bg-red-600 px-4 py-2"
                      disabled={busy}
                      onPress={onStopVoiceRecording}
                    >
                      <Text className="text-center font-semibold text-white">
                        Stop recording
                      </Text>
                    </Pressable>
                    <VoiceNoteRecorderElapsed recorder={newAudioRecorder} />
                  </>
                ) : (
                  <Pressable
                    className={`mt-3 rounded-md px-4 py-2 ${newAudioDraft ? "bg-neutral-300" : "bg-emerald-600"}`}
                    disabled={Boolean(newAudioDraft) || busy}
                    onPress={onStartVoiceRecording}
                  >
                    <Text className="text-center font-semibold text-white">
                      Start voice recording
                    </Text>
                  </Pressable>
                )}
                {newAudioDraft ? (
                  <View className="mt-3 gap-2">
                    <VoiceNoteDraftPlayback
                      uri={newAudioDraft.uri}
                      busy={busy}
                      totalSecondsHint={newAudioDraft.durationSeconds}
                    />
                    <Pressable
                      className="rounded-md bg-emerald-700 px-4 py-2"
                      disabled={busy}
                      onPress={onSaveVoiceNote}
                    >
                      <Text className="text-center font-semibold text-white">
                        Save
                      </Text>
                    </Pressable>
                    <Pressable
                      className="rounded-md bg-neutral-600 px-4 py-2"
                      disabled={busy}
                      onPress={onDiscardVoiceRecording}
                    >
                      <Text className="text-center font-semibold text-white">
                        Discard
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
