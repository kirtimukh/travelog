import { Pressable, Text, View } from "react-native";

import type { MediaRow, NoteRow } from "../../../db/schema";

type FeedItem =
  | { kind: "note"; data: NoteRow; sortTs: number }
  | { kind: "media"; data: MediaRow; sortTs: number };

function buildFeed(notes: NoteRow[], media: MediaRow[]): FeedItem[] {
  const items: FeedItem[] = [
    ...notes.map((n) => ({
      kind: "note" as const,
      data: n,
      sortTs: n.timestamp,
    })),
    ...media.map((m) => ({
      kind: "media" as const,
      data: m,
      sortTs: m.timestamp ?? Number.MAX_SAFE_INTEGER,
    })),
  ];
  items.sort((a, b) => a.sortTs - b.sortTs);
  return items;
}

function notePreviewText(note: NoteRow): string {
  const text = note.text?.trim();
  if (text) {
    return text;
  }
  const transcript = note.audio_transcript?.trim();
  if (transcript) {
    return transcript;
  }
  if (note.type === "voice") {
    return "Voice note";
  }
  return "";
}

type Props = {
  notes: NoteRow[];
  media: MediaRow[];
  /** When false, items are display-only (no long-press to edit). Default true. */
  editable?: boolean;
  onLongPressNote: (note: NoteRow) => void;
  onLongPressMedia: (item: MediaRow) => void;
};

export function JourneyNotesFeed({
  notes,
  media,
  editable = true,
  onLongPressNote,
  onLongPressMedia,
}: Props) {
  const feed = buildFeed(notes, media);
  const total = notes.length + media.length;

  return (
    <View className="mb-10 mt-6 rounded-xl border border-neutral-200 p-4">
      <Text className="text-base font-semibold text-neutral-900">Notes ({total})</Text>
      {feed.map((item) =>
        item.kind === "note" ? (
          editable ? (
            <Pressable
              key={`note-${item.data.id}`}
              className="mt-3 rounded-md border border-neutral-200 p-3 active:bg-neutral-50"
              onLongPress={() => {
                onLongPressNote(item.data);
              }}
              delayLongPress={350}
            >
              <Text className="text-sm text-neutral-900">{notePreviewText(item.data)}</Text>
            </Pressable>
          ) : (
            <View
              key={`note-${item.data.id}`}
              className="mt-3 rounded-md border border-neutral-200 p-3"
            >
              <Text className="text-sm text-neutral-900">{notePreviewText(item.data)}</Text>
            </View>
          )
        ) : editable ? (
          <Pressable
            key={`media-${item.data.id}`}
            className="mt-3 overflow-hidden rounded-md border border-neutral-200 active:bg-neutral-50"
            onLongPress={() => {
              onLongPressMedia(item.data);
            }}
            delayLongPress={350}
          >
            <View className="aspect-video w-full items-center justify-center bg-neutral-200">
              <Text className="text-xs font-medium text-neutral-500">Image</Text>
            </View>
            {item.data.text?.trim() ? (
              <Text className="p-3 text-sm text-neutral-900">{item.data.text.trim()}</Text>
            ) : null}
          </Pressable>
        ) : (
          <View
            key={`media-${item.data.id}`}
            className="mt-3 overflow-hidden rounded-md border border-neutral-200"
          >
            <View className="aspect-video w-full items-center justify-center bg-neutral-200">
              <Text className="text-xs font-medium text-neutral-500">Image</Text>
            </View>
            {item.data.text?.trim() ? (
              <Text className="p-3 text-sm text-neutral-900">{item.data.text.trim()}</Text>
            ) : null}
          </View>
        ),
      )}
    </View>
  );
}
