import { Keyboard, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useModalKeyboardInset } from "../hooks/useModalKeyboardInset";

export type JourneyAddMediaModalProps = {
  visible: boolean;
  text: string;
  onChangeText: (text: string) => void;
  busy: boolean;
  onPickImage: () => void;
  onRequestClose: () => void;
};

export function JourneyAddMediaModal({
  visible,
  text,
  onChangeText,
  busy,
  onPickImage,
  onRequestClose,
}: JourneyAddMediaModalProps) {
  const insets = useSafeAreaInsets();
  const modalPaddingBottom = Math.max(insets.bottom + 16, 32);
  const modalKeyboardInset = useModalKeyboardInset();

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
              transform: [{ translateY: -modalKeyboardInset }],
            }}
          >
            <Text className="text-base font-semibold text-neutral-900">Add media</Text>
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
          </View>
        </View>
      </View>
    </Modal>
  );
}
