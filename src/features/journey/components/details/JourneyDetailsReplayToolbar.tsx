import { Pressable, ScrollView as RNScrollView, Text, View } from "react-native";

import type { UseJourneyDetailsReplayResult } from "../../hooks/useJourneyDetailsReplay";

type Props = {
  replay: UseJourneyDetailsReplayResult;
};

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
          className="mt-2 max-h-24"
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {replay.eventFeed.length === 0 ? (
            <Text className="text-xs text-neutral-500">No event at current replay time.</Text>
          ) : (
            replay.eventFeed.map((entry, index) => (
              <Text key={`${entry}-${index}`} className="mb-1 text-xs text-neutral-700">
                {entry}
              </Text>
            ))
          )}
        </RNScrollView>
      </View>
    </>
  );
}
