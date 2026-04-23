import {
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useModalKeyboardInset } from "../hooks/useModalKeyboardInset";


export type JourneyMediaEditModalProps = {
  visible: boolean;
  file: string;
  width: number | null;
  height: number | null;
  text: string;
  onChangeText: (text: string) => void;
  timestampEpochMs: string;
  onChangeTimestampEpochMs: (text: string) => void;
  localDateTime: string;
  onChangeLocalDateTime: (text: string) => void;
  lat: string;
  onChangeLat: (text: string) => void;
  lng: string;
  onChangeLng: (text: string) => void;
  busy: boolean;
  onRequestClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

export function JourneyMediaEditModal({
  visible,
  file,
  width,
  height,
  text,
  onChangeText,
  timestampEpochMs,
  onChangeTimestampEpochMs,
  localDateTime,
  onChangeLocalDateTime,
  lat,
  onChangeLat,
  lng,
  onChangeLng,
  busy,
  onRequestClose,
  onSave,
  onDelete,
}: JourneyMediaEditModalProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const modalPaddingBottom = Math.max(insets.bottom + 16, 32);
  const keyboardInset = useModalKeyboardInset();
  const sheetMaxHeight = Math.max(360, Math.round(screenHeight * 0.72));
  const previewFrameWidth = Math.max(0, screenWidth - 32);
  const previewFrameMaxHeight = Math.max(150, Math.round(screenHeight * 0.3));
  const previewAspectRatio =
    width != null && height != null && width > 0 && height > 0 ? width / height : 1;
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
          <ScrollView
            className="rounded-t-2xl border-t border-neutral-200 bg-white px-4 pt-4"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: modalPaddingBottom }}
            style={{
              maxHeight: sheetMaxHeight,
              transform: [{ translateY: -keyboardInset }],
            }}
          >
            <Text className="text-base font-semibold text-neutral-900">Edit image</Text>
            <View
              className="mt-3 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
              style={{ height: previewFrameMaxHeight }}
            >
              <Image
                source={{ uri: file }}
                style={{
                  height: Math.max(1, previewHeight),
                  width: Math.max(1, previewWidth),
                }}
                resizeMode="contain"
              />
            </View>
            <TextInput
              className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Caption (optional)"
              value={text}
              onChangeText={onChangeText}
            />
            <TextInput
              className="mt-2 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Local datetime (YYYY-MM-DD HH:mm:ss)"
              value={localDateTime}
              onChangeText={onChangeLocalDateTime}
            />
            <TextInput
              className="mt-2 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Epoch timestamp (ms)"
              value={timestampEpochMs}
              onChangeText={onChangeTimestampEpochMs}
              keyboardType="numeric"
            />
            <TextInput
              className="mt-2 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Latitude"
              value={lat}
              onChangeText={onChangeLat}
              keyboardType="numeric"
            />
            <TextInput
              className="mt-2 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Longitude"
              value={lng}
              onChangeText={onChangeLng}
              keyboardType="numeric"
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
