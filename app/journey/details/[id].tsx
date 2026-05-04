import { useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JourneyArtifactsEditorModals } from "../../../src/features/journey/journeyArtifacts/JourneyArtifactsEditorModals";
import { JourneyArtifactsFeed } from "../../../src/features/journey/journeyArtifacts/JourneyArtifactsFeed";
import { JourneyDetailsMapSection } from "../../../src/features/journey/components/details/JourneyDetailsMapSection";
import { JourneyDetailsReplayStatsCard } from "../../../src/features/journey/components/details/JourneyDetailsReplayStatsCard";
import { JourneyDetailsReplayToolbar } from "../../../src/features/journey/components/details/JourneyDetailsReplayToolbar";
import { useJourneyDetailsData } from "../../../src/features/journey/hooks/useJourneyDetailsData";
import { useJourneyDetailsHeaderOptions } from "../../../src/features/journey/hooks/useJourneyDetailsHeaderOptions";
import { useJourneyExport } from "../../../src/features/journey/hooks/useJourneyExport";
import { useJourneyDetailsReplay } from "../../../src/features/journey/hooks/useJourneyDetailsReplay";
import { useMediaEditFlow } from "../../../src/features/journey/hooks/useMediaEditFlow";
import { useNoteEditFlow } from "../../../src/features/journey/hooks/useNoteEditFlow";
import { useWeatherCaptureFlow } from "../../../src/features/journey/hooks/useWeatherCaptureFlow";
import { canEditInDetails } from "../../../src/features/journey/status";
import { useOngoingJourneyCandidate } from "../../../src/features/journey/useOngoingJourneyCandidate";

export default function JourneyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const journeyId = Number(id);
  const insets = useSafeAreaInsets();
  const { ongoingJourneyId, refreshOngoingJourney } = useOngoingJourneyCandidate();

  const {
    journey,
    points,
    notes,
    media,
    weather,
    locationPermission,
    screenError,
    setScreenError,
    deleteJourneyBusy,
    refresh,
    requestPermission,
    requestDeleteJourney,
  } = useJourneyDetailsData({ journeyId, refreshOngoingJourney });

  const noteEditFlow = useNoteEditFlow({ refreshJourneyData: refresh });

  const formatMediaEditUtcIso = useCallback(
    (ts: number | null) =>
      ts == null ? "" : new Date(ts).toISOString().replace("T", " ").slice(0, 19),
    [],
  );

  const mediaEditFlow = useMediaEditFlow({
    journeyId,
    refreshJourneyData: refresh,
    formatEditLocalDateTime: formatMediaEditUtcIso,
  });

  const replay = useJourneyDetailsReplay({
    journeyId,
    journey,
    points,
    notes,
    media,
    weather,
  });

  const weatherCaptureFlow = useWeatherCaptureFlow({
    journeyId,
    refreshJourneyData: refresh,
  });

  const noteOrMediaBusy = noteEditFlow.busy || mediaEditFlow.editModal.busy;

  const journeyExport = useJourneyExport({
    journeyId,
    journey,
    setScreenError,
  });

  const exportJourneyDisabled =
    journey == null ||
    journey.status === "scheduled" ||
    noteOrMediaBusy ||
    deleteJourneyBusy ||
    journeyExport.exportBusy;

  useJourneyDetailsHeaderOptions({
    navigation,
    journey,
    journeyId,
    ongoingJourneyId,
    requestDeleteJourney,
    deleteJourneyBusy,
    noteOrMediaBusy,
    requestExportJourneyDownload: journeyExport.requestExportJourneyDownload,
    requestExportJourneyShare: journeyExport.requestExportJourneyShare,
    exportJourneyDisabled,
    exportBusy: journeyExport.exportBusy,
  });

  const editable = canEditInDetails(journey?.status ?? "");

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1 px-6 pt-12"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 40) }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        waitFor={replay.mapGestureRef}
      >
        <Text className="text-xl font-bold">{journey?.name ?? "Journey details"}</Text>
        <Text className="mt-2 text-neutral-600">Status: {journey?.status ?? "—"}</Text>
        {screenError ? <Text className="mt-2 text-sm text-red-700">{screenError}</Text> : null}
        {journeyExport.exportWarning ? (
          <View className="mt-3 flex-row items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <Text className="shrink text-sm text-amber-900">{journeyExport.exportWarning}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={journeyExport.dismissExportWarning}
              className="rounded bg-amber-200 px-2 py-1"
            >
              <Text className="text-xs font-semibold text-amber-900">Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

        <JourneyDetailsMapSection
          mapNativeGesture={replay.mapNativeGesture}
          replayPath={replay.replayPath}
          replayPoint={replay.replayPoint}
          hasLocationPermission={locationPermission}
          onGrantLocation={() => {
            void requestPermission();
          }}
        />

        <JourneyDetailsReplayStatsCard
          replayTs={replay.replayTs}
          journeyDurationMs={replay.journeyDurationMs}
          replayDurationMs={replay.replayDurationMs}
          recordedDistanceMeters={replay.recordedDistanceMeters}
          speed={replay.speed}
          heading={replay.heading}
        />

        <JourneyDetailsReplayToolbar replay={replay} />

        {!editable ? (
          <Text className="mt-4 text-sm text-neutral-600">
            Editing notes/media is disabled while journey is ongoing.
          </Text>
        ) : null}

        <JourneyArtifactsFeed
          notes={notes}
          media={media}
          weather={weather}
          pauseWindows={replay.replayPauseWindows}
          locationPoints={points}
          editable={editable}
          noteEdit={noteEditFlow}
          mediaEdit={mediaEditFlow}
          weatherCapture={weatherCaptureFlow}
        />
      </ScrollView>

      <JourneyArtifactsEditorModals
        noteEdit={noteEditFlow}
        mediaEdit={mediaEditFlow}
        weatherCapture={weatherCaptureFlow}
        onRerecordAudio={() => {
          setScreenError("Re-recording is only available on the live journey screen.");
          noteEditFlow.close();
        }}
        weatherOnDelete={editable ? weatherCaptureFlow.modal.requestDeleteWeather : undefined}
      />
    </View>
  );
}
