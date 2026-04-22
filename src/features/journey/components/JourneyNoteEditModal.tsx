import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect } from "react";
import { Keyboard, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { NoteRow } from "../../../db/schema";
import { formatDurationSeconds } from "../formatDuration";

export type JourneyNoteEditModalProps = {
  visible: boolean;
  note: NoteRow | null;
  text: string;
  onChangeText: (text: string) => void;
  busy: boolean;
  keyboardInset: number;
  onRequestClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onRerecordAudio: () => void;
};

export function JourneyNoteEditModal({
  visible,
  note,
  text,
  onChangeText,
  busy,
  keyboardInset,
  onRequestClose,
  onSave,
  onDelete,
  onRerecordAudio,
}: JourneyNoteEditModalProps) {
  const isText = note?.type === "text";
  const isVoice = note?.type === "voice";
  const audioSource = note?.type === "voice" && note.audio_file ? note.audio_file : null;
  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);
  const insets = useSafeAreaInsets();
  const modalPaddingBottom = Math.max(insets.bottom + 16, 32);

  useEffect(() => {
    if (!visible) {
      player.pause();
    }
  }, [visible, player]);

  const togglePlayback = useCallback(async () => {
    if (!audioSource) {
      return;
    }
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
    audioSource,
    player,
    status.currentTime,
    status.didJustFinish,
    status.duration,
    status.playing,
  ]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onRequestClose}
    >
      <View className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/50"
            onPress={() => {
              Keyboard.dismiss();
              onRequestClose();
            }}
          />
          <View
            className="rounded-t-2xl border-t border-neutral-200 bg-white px-4 pt-4"
            style={{
              paddingBottom: modalPaddingBottom,
              transform: [{ translateY: -keyboardInset }],
            }}
          >
            <Text className="text-base font-semibold text-neutral-900">Edit note</Text>
            {isText ? (
              <TextInput
                className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm"
                placeholder="Note text"
                value={text}
                onChangeText={onChangeText}
              />
            ) : null}
            {isVoice ? (
              <Text className="mt-3 text-sm text-neutral-600">Voice note</Text>
            ) : null}
            {isVoice ? (
              <>
                {note?.audio_file ? (
                  <View className="mt-3">
                    <Text className="mb-2 text-center text-sm tabular-nums text-neutral-700">
                      {formatDurationSeconds(status.currentTime)} /{" "}
                      {status.duration > 0 ? formatDurationSeconds(status.duration) : "—:—"}
                    </Text>
                    <Pressable
                      className={`rounded-md px-3 py-2 ${busy || !status.isLoaded ? "bg-neutral-300" : "bg-neutral-700"}`}
                      disabled={busy || !status.isLoaded}
                      onPress={() => {
                        void togglePlayback();
                      }}
                    >
                      <Text className="text-center font-semibold text-white">
                        {status.playing ? "Pause" : "Play"}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    className={`mt-3 rounded-md px-3 py-2 ${busy ? "bg-neutral-300" : "bg-emerald-700"}`}
                    disabled={busy}
                    onPress={onRerecordAudio}
                  >
                    <Text className="text-center font-semibold text-white">Re-record audio</Text>
                  </Pressable>
                )}
              </>
            ) : null}
            <Pressable
              className={`mt-3 rounded-md px-3 py-2 ${busy ? "bg-neutral-300" : "bg-red-700"}`}
              disabled={busy}
              onPress={onDelete}
            >
              <Text className="text-center font-semibold text-white">Delete note</Text>
            </Pressable>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2"
                onPress={onRequestClose}
              >
                <Text className="text-center font-semibold text-neutral-900">Cancel</Text>
              </Pressable>
              {isText ? (
                <Pressable
                  className={`flex-1 rounded-md px-3 py-2 ${busy ? "bg-neutral-300" : "bg-blue-600"}`}
                  disabled={busy}
                  onPress={onSave}
                >
                  <Text className="text-center font-semibold text-white">Save</Text>
                </Pressable>
              ) : isVoice ? (
                <Pressable
                  className="flex-1 rounded-md bg-blue-600 px-3 py-2"
                  onPress={() => {
                    Keyboard.dismiss();
                    onRequestClose();
                  }}
                >
                  <Text className="text-center font-semibold text-white">Done</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
