import { Keyboard, Modal, Pressable, Text, TextInput, View } from "react-native";

import type { NoteType } from "../../../db/schema";
import type { VoiceRecorder } from "../../../files/voiceRecording";
import { VoiceNoteDraftPlayback } from "./VoiceNoteDraftPlayback";
import { VoiceNoteRecorderElapsed } from "./VoiceNoteRecorderElapsed";

type VoiceNoteDraft = {
  uri: string;
  durationSeconds: number;
};

type Props = {
  visible: boolean;
  modalPaddingBottom: number;
  modalKeyboardInset: number;
  newNoteMode: NoteType;
  newNoteText: string;
  newAudioRecorder: VoiceRecorder | null;
  newAudioDraft: VoiceNoteDraft | null;
  busy: boolean;
  onClose: () => void;
  onSwitchAddNoteMode: (next: NoteType) => void;
  onChangeNewNoteText: (text: string) => void;
  onAddTextNote: () => void;
  onStartVoiceRecording: () => void;
  onStopVoiceRecording: () => void;
  onSaveVoiceNote: () => void;
  onDiscardVoiceRecording: () => void;
};

export function JourneyAddNoteModal({
  visible,
  modalPaddingBottom,
  modalKeyboardInset,
  newNoteMode,
  newNoteText,
  newAudioRecorder,
  newAudioDraft,
  busy,
  onClose,
  onSwitchAddNoteMode,
  onChangeNewNoteText,
  onAddTextNote,
  onStartVoiceRecording,
  onStopVoiceRecording,
  onSaveVoiceNote,
  onDiscardVoiceRecording,
}: Props) {
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
            <Text className="text-base font-semibold text-neutral-900">Add note</Text>
            <View className="mt-3 flex-row rounded-lg border border-neutral-300 p-0.5">
              <Pressable
                className={`flex-1 rounded-md py-2 ${newNoteMode === "text" ? "bg-blue-600" : "bg-transparent"}`}
                onPress={() => {
                  onSwitchAddNoteMode("text");
                }}
              >
                <Text
                  className={`text-center text-sm font-semibold ${newNoteMode === "text" ? "text-white" : "text-neutral-700"}`}
                >
                  Text
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 rounded-md py-2 ${newNoteMode === "voice" ? "bg-emerald-600" : "bg-transparent"}`}
                onPress={() => {
                  onSwitchAddNoteMode("voice");
                }}
              >
                <Text
                  className={`text-center text-sm font-semibold ${newNoteMode === "voice" ? "text-white" : "text-neutral-700"}`}
                >
                  Voice
                </Text>
              </Pressable>
            </View>
            {newNoteMode === "text" ? (
              <>
                <TextInput
                  className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Note text"
                  value={newNoteText}
                  onChangeText={onChangeNewNoteText}
                />
                <Pressable
                  className="mt-3 rounded-md bg-blue-600 px-4 py-2"
                  disabled={busy}
                  onPress={onAddTextNote}
                >
                  <Text className="text-center font-semibold text-white">Save text note</Text>
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
                        Save voice note
                      </Text>
                    </Pressable>
                    <Pressable
                      className="rounded-md bg-neutral-600 px-4 py-2"
                      disabled={busy}
                      onPress={onDiscardVoiceRecording}
                    >
                      <Text className="text-center font-semibold text-white">
                        Discard recording
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
