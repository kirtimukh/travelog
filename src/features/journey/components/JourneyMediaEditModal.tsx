import { Keyboard, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useModalKeyboardInset } from "../hooks/useModalKeyboardInset";

export type JourneyMediaEditModalProps = {
  visible: boolean;
  text: string;
  onChangeText: (text: string) => void;
  busy: boolean;
  onRequestClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

export function JourneyMediaEditModal({
  visible,
  text,
  onChangeText,
  busy,
  onRequestClose,
  onSave,
  onDelete,
}: JourneyMediaEditModalProps) {
  const insets = useSafeAreaInsets();
  const modalPaddingBottom = Math.max(insets.bottom + 16, 32);
  const keyboardInset = useModalKeyboardInset();

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
            <Text className="text-base font-semibold text-neutral-900">Edit image</Text>
            <TextInput
              className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Caption (optional)"
              value={text}
              onChangeText={onChangeText}
            />
            <Pressable
              className={`mt-3 rounded-md px-3 py-2 ${busy ? "bg-neutral-300" : "bg-red-700"}`}
              disabled={busy}
              onPress={onDelete}
            >
              <Text className="text-center font-semibold text-white">Delete image</Text>
            </Pressable>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2"
                onPress={onRequestClose}
              >
                <Text className="text-center font-semibold text-neutral-900">Cancel</Text>
              </Pressable>
              <Pressable
                className={`flex-1 rounded-md px-3 py-2 ${busy ? "bg-neutral-300" : "bg-blue-600"}`}
                disabled={busy}
                onPress={onSave}
              >
                <Text className="text-center font-semibold text-white">Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
