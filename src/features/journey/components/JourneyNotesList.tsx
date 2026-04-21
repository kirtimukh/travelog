import { Pressable, Text, TextInput, View } from "react-native";

import type { NoteRow } from "../../../db/schema";

type Props = {
  notes: NoteRow[];
  editable: boolean;
  onUpdateText: (note: NoteRow, text: string) => void;
  onDiscardAudio: (note: NoteRow) => void;
  onRerecordAudio: (note: NoteRow) => void;
  onDelete: (note: NoteRow) => void;
};

export function JourneyNotesList({
  notes,
  editable,
  onUpdateText,
  onDiscardAudio,
  onRerecordAudio,
  onDelete,
}: Props) {
  return (
    <View className="mt-6 rounded-xl border border-neutral-200 p-4">
      <Text className="text-base font-semibold text-neutral-900">Notes ({notes.length})</Text>
      {notes.map((note) => (
        <View key={note.id} className="mt-3 rounded-md border border-neutral-200 p-3">
          <Text className="text-xs text-neutral-600">
            {note.type} | {new Date(note.timestamp).toLocaleString()}
          </Text>
          <TextInput
            className={`mt-2 rounded-md border px-3 py-2 text-sm ${editable ? "border-neutral-300" : "border-neutral-200 bg-neutral-100 text-neutral-500"}`}
            placeholder="Edit note text"
            defaultValue={note.text ?? ""}
            editable={editable}
            onEndEditing={(e) => {
              if (editable) {
                onUpdateText(note, e.nativeEvent.text);
              }
            }}
          />
          {note.audio_file ? (
            <Pressable
              className={`mt-2 rounded-md px-3 py-2 ${editable ? "bg-neutral-700" : "bg-neutral-300"}`}
              disabled={!editable}
              onPress={() => {
                onDiscardAudio(note);
              }}
            >
              <Text className="text-center font-semibold text-white">Discard audio</Text>
            </Pressable>
          ) : (
            <Pressable
              className={`mt-2 rounded-md px-3 py-2 ${editable ? "bg-emerald-700" : "bg-neutral-300"}`}
              disabled={!editable}
              onPress={() => {
                onRerecordAudio(note);
              }}
            >
              <Text className="text-center font-semibold text-white">Re-record audio</Text>
            </Pressable>
          )}
          <Pressable
            className={`mt-2 rounded-md px-3 py-2 ${editable ? "bg-red-700" : "bg-neutral-300"}`}
            disabled={!editable}
            onPress={() => {
              onDelete(note);
            }}
          >
            <Text className="text-center font-semibold text-white">Delete note</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
