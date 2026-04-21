import { Pressable, Text, TextInput, View } from "react-native";

import type { MediaRow } from "../../../db/schema";

type Props = {
  media: MediaRow[];
  editable: boolean;
  onUpdateText: (item: MediaRow, text: string) => void;
  onDelete: (item: MediaRow) => void;
};

export function JourneyMediaList({
  media,
  editable,
  onUpdateText,
  onDelete,
}: Props) {
  return (
    <View className="mb-10 mt-6 rounded-xl border border-neutral-200 p-4">
      <Text className="text-base font-semibold text-neutral-900">Media ({media.length})</Text>
      {media.map((item) => (
        <View key={item.id} className="mt-3 rounded-md border border-neutral-200 p-3">
          <Text className="text-xs text-neutral-600">{item.file}</Text>
          <TextInput
            className={`mt-2 rounded-md border px-3 py-2 text-sm ${editable ? "border-neutral-300" : "border-neutral-200 bg-neutral-100 text-neutral-500"}`}
            placeholder="Edit media.text"
            defaultValue={item.text ?? ""}
            editable={editable}
            onEndEditing={(e) => {
              if (editable) {
                onUpdateText(item, e.nativeEvent.text);
              }
            }}
          />
          <Pressable
            className={`mt-2 rounded-md px-3 py-2 ${editable ? "bg-red-700" : "bg-neutral-300"}`}
            disabled={!editable}
            onPress={() => {
              onDelete(item);
            }}
          >
            <Text className="text-center font-semibold text-white">Delete media</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
