import { Image, Pressable, ScrollView as RNScrollView, Text, View } from "react-native";

import type { ReplayCard, UseJourneyDetailsReplayResult } from "../../hooks/useJourneyDetailsReplay";
import { formatVoiceReplayDuration } from "../../formatDuration";
import { MEDIA_FEED_THUMBNAIL_HEIGHT, mediaThumbWidth } from "../JourneyNotesFeed.utils";

type Props = {
  replay: UseJourneyDetailsReplayResult;
};

function caption100(text: string | null): string {
  return (text ?? "").slice(0, 100);
}

function ReplayCardContent({ card }: { card: ReplayCard }) {
  const { entry } = card;
  switch (entry.kind) {
    case "text_note":
      return (
        <Text className="text-xs text-neutral-700">
          {entry.preview100.length > 0 ? entry.preview100 : "—"}
        </Text>
      );
    case "voice_note":
      return (
        <Text className="text-xs text-neutral-700">{formatVoiceReplayDuration(entry.durationSec)}</Text>
      );
    case "image": {
      const cap = caption100(entry.media.text);
      return (
        <View>
          <Image
            source={{ uri: entry.media.file }}
            style={{ height: MEDIA_FEED_THUMBNAIL_HEIGHT, width: mediaThumbWidth(entry.media) }}
            resizeMode="contain"
          />
          {cap.length > 0 ? (
            <Text className="mt-1 text-xs text-neutral-700">{cap}</Text>
          ) : null}
        </View>
      );
    }
  }
}

export function JourneyDetailsReplayToolbar({ replay }: Props) {
  if (!replay.canReplay) {
    return (
      <Text className="mt-3 text-sm text-neutral-600">
        Replay is unavailable for scheduled journeys.
      </Text>
    );
  }

  return (
    <>
      <View className="mt-4 flex-row items-center gap-2">
        <Pressable
          className="min-w-12 rounded-md bg-neutral-700 px-3 py-3"
          onPressIn={() => {
            replay.handleDirectionalPressIn(-1);
          }}
          onPressOut={() => {
            replay.handleDirectionalPressOut(-1);
          }}
        >
          <Text className="text-center font-semibold text-white">{"<<"}</Text>
        </Pressable>
        <Pressable
          className="min-w-12 rounded-md bg-amber-700 px-3 py-3"
          onPress={replay.resetReplayControls}
        >
          <Text className="text-center font-semibold text-white">↺</Text>
        </Pressable>
        <Pressable
          className={`min-w-12 rounded-md px-3 py-3 ${replay.isReplaying ? "bg-amber-600" : "bg-emerald-600"}`}
          onPress={() => {
            replay.setHoldDirection(0);
            replay.setIsReplaying((current) => !current);
          }}
        >
          <Text className="text-center font-semibold text-white">
            {replay.isReplaying ? "||" : "▶"}
          </Text>
        </Pressable>
        <Pressable
          className="min-w-12 rounded-md bg-neutral-700 px-3 py-3"
          onPressIn={() => {
            replay.handleDirectionalPressIn(1);
          }}
          onPressOut={() => {
            replay.handleDirectionalPressOut(1);
          }}
        >
          <Text className="text-center font-semibold text-white">{">>"}</Text>
        </Pressable>
      </View>

      <View className="mt-4 rounded-xl border border-neutral-200 p-3">
        <Text className="text-sm font-semibold text-neutral-800">Replay events</Text>
        <RNScrollView
          ref={replay.eventScrollRef}
          className="mt-2 max-h-40"
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {replay.replayCards.length === 0 ? (
            <Text className="text-xs text-neutral-500">No event at current replay time.</Text>
          ) : (
            replay.replayCards.map((card) => (
              <View key={card.reactKey} className="mb-2 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                <ReplayCardContent card={card} />
              </View>
            ))
          )}
        </RNScrollView>
      </View>
    </>
  );
}
