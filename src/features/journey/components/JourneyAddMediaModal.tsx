import { Image, Keyboard, Modal, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useModalKeyboardInset } from "../hooks/useModalKeyboardInset";


export type JourneyAddMediaModalProps = {
  visible: boolean;
  text: string;
  selectedFile: string | null;
  selectedWidth: number | null;
  selectedHeight: number | null;
  onChangeText: (text: string) => void;
  busy: boolean;
  onPickImage: () => void;
  onSave: () => void;
  onRequestClose: () => void;
};

export function JourneyAddMediaModal({
  visible,
  text,
  selectedFile,
  selectedWidth,
  selectedHeight,
  onChangeText,
  busy,
  onPickImage,
  onSave,
  onRequestClose,
}: JourneyAddMediaModalProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const modalPaddingBottom = Math.max(insets.bottom + 16, 32);
  const modalKeyboardInset = useModalKeyboardInset();
  const sheetMaxHeight = Math.max(300, Math.round(screenHeight * 0.62));
  const previewFrameWidth = Math.max(0, screenWidth - 32);
  const previewFrameMaxHeight = Math.max(140, Math.round(screenHeight * 0.28));
  const previewAspectRatio =
    selectedWidth != null && selectedHeight != null && selectedWidth > 0 && selectedHeight > 0
      ? selectedWidth / selectedHeight
      : 1;
  const previewWidth = Math.min(previewFrameWidth, previewFrameMaxHeight * previewAspectRatio);
  const previewHeight = previewWidth / previewAspectRatio;

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
              maxHeight: sheetMaxHeight,
              paddingBottom: modalPaddingBottom,
              transform: [{ translateY: -modalKeyboardInset }],
            }}
          >
            <Text className="text-base font-semibold text-neutral-900">Add media</Text>
            {selectedFile ? (
              <View
                className="mt-3 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
                style={{ height: previewFrameMaxHeight }}
              >
                <Image
                  source={{ uri: selectedFile }}
                  style={{
                    height: Math.max(1, previewHeight),
                    width: Math.max(1, previewWidth),
                  }}
                  resizeMode="contain"
                />
              </View>
            ) : null}
            <TextInput
              className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Caption (optional)"
              value={text}
              onChangeText={onChangeText}
            />
            <Pressable
              className={`mt-3 rounded-md px-4 py-2 ${busy ? "bg-neutral-300" : "bg-blue-600"}`}
              disabled={busy}
              onPress={onPickImage}
            >
              <Text className="text-center font-semibold text-white">Pick image</Text>
            </Pressable>
            <Pressable
              className={`mt-2 rounded-md px-4 py-2 ${
                busy || !selectedFile ? "bg-neutral-300" : "bg-emerald-600"
              }`}
              disabled={busy || !selectedFile}
              onPress={onSave}
            >
              <Text className="text-center font-semibold text-white">Save media</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
