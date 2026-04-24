import { useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JourneyMediaEditModal } from "../../../src/features/journey/components/JourneyMediaEditModal";
import { JourneyNoteEditModal } from "../../../src/features/journey/components/JourneyNoteEditModal";
import { JourneyNotesFeed } from "../../../src/features/journey/components/JourneyNotesFeed";
import { JourneyWeatherModal } from "../../../src/features/journey/components/JourneyWeatherModal";
import { JourneyDetailsMapSection } from "../../../src/features/journey/components/details/JourneyDetailsMapSection";
import { JourneyDetailsReplayStatsCard } from "../../../src/features/journey/components/details/JourneyDetailsReplayStatsCard";
import { JourneyDetailsReplayToolbar } from "../../../src/features/journey/components/details/JourneyDetailsReplayToolbar";
import { useJourneyDetailsData } from "../../../src/features/journey/hooks/useJourneyDetailsData";
import { useJourneyDetailsHeaderOptions } from "../../../src/features/journey/hooks/useJourneyDetailsHeaderOptions";
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

  useJourneyDetailsHeaderOptions({
    navigation,
    journey,
    journeyId,
    ongoingJourneyId,
    requestDeleteJourney,
    deleteJourneyBusy,
    noteOrMediaBusy,
  });

  const editable = canEditInDetails(journey?.status ?? "");

  return (
    <ScrollView
      className="flex-1 bg-white px-6 pt-12"
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 40) }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      waitFor={replay.mapGestureRef}
    >
      <Text className="text-xl font-bold">{journey?.name ?? "Journey details"}</Text>
      <Text className="mt-2 text-neutral-600">Status: {journey?.status ?? "—"}</Text>
      {screenError ? <Text className="mt-2 text-sm text-red-700">{screenError}</Text> : null}

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

      <JourneyNotesFeed
        notes={notes}
        media={media}
        weather={weather}
        pauseWindows={replay.replayPauseWindows}
        locationPoints={points}
        editable={editable}
        suspendPlayback={
          noteEditFlow.target !== null ||
          mediaEditFlow.editModal.target !== null ||
          weatherCaptureFlow.modal.visible
        }
        onLongPressNote={(note) => {
          if (!editable) {
            return;
          }
          noteEditFlow.openFor(note);
        }}
        onLongPressMedia={(item) => {
          if (!editable) {
            return;
          }
          mediaEditFlow.editModal.openFor(item);
        }}
        onLongPressWeather={(row) => {
          weatherCaptureFlow.modal.openForWeather(row);
        }}
      />

      <JourneyNoteEditModal
        visible={noteEditFlow.target !== null}
        note={noteEditFlow.target}
        text={noteEditFlow.text}
        onChangeText={noteEditFlow.onChangeText}
        busy={noteEditFlow.busy}
        onRequestClose={noteEditFlow.close}
        onSave={() => {
          void noteEditFlow.save();
        }}
        onDelete={() => {
          void noteEditFlow.remove();
        }}
        onRerecordAudio={() => {
          setScreenError("Re-recording is only available on the live journey screen.");
          noteEditFlow.close();
        }}
      />

      <JourneyMediaEditModal
        visible={mediaEditFlow.editModal.target !== null}
        file={mediaEditFlow.editModal.target?.file ?? ""}
        width={mediaEditFlow.editModal.target?.width ?? null}
        height={mediaEditFlow.editModal.target?.height ?? null}
        text={mediaEditFlow.editModal.text}
        onChangeText={mediaEditFlow.editModal.onChangeText}
        timestampEpochMs={mediaEditFlow.editModal.timestampEpochMs}
        onChangeTimestampEpochMs={mediaEditFlow.editModal.onChangeTimestampEpochMs}
        localDateTime={mediaEditFlow.editModal.localDateTime}
        onChangeLocalDateTime={mediaEditFlow.editModal.onChangeLocalDateTime}
        lat={mediaEditFlow.editModal.lat}
        onChangeLat={mediaEditFlow.editModal.onChangeLat}
        lng={mediaEditFlow.editModal.lng}
        onChangeLng={mediaEditFlow.editModal.onChangeLng}
        busy={mediaEditFlow.editModal.busy}
        onRequestClose={mediaEditFlow.editModal.close}
        onSave={() => {
          void mediaEditFlow.editModal.save();
        }}
        onDelete={() => {
          void mediaEditFlow.editModal.remove();
        }}
      />

      <JourneyWeatherModal
        visible={weatherCaptureFlow.modal.visible}
        mode={weatherCaptureFlow.modal.mode}
        busy={weatherCaptureFlow.modal.busy}
        offline={weatherCaptureFlow.modal.offline}
        error={weatherCaptureFlow.modal.error}
        quotaLabel={weatherCaptureFlow.modal.quotaLabel}
        canRequest={weatherCaptureFlow.modal.canRequest}
        weatherDisplay={weatherCaptureFlow.modal.weatherDisplay}
        dismissButtonLabel={weatherCaptureFlow.modal.dismissButtonLabel}
        onRetry={() => {
          void weatherCaptureFlow.modal.retryAvailability();
        }}
        onRequestWeather={() => {
          void weatherCaptureFlow.modal.requestWeather();
        }}
        onDismiss={weatherCaptureFlow.modal.close}
        onSave={() => {
          void weatherCaptureFlow.modal.savePreview();
        }}
        onDelete={editable ? weatherCaptureFlow.modal.requestDeleteWeather : undefined}
      />
    </ScrollView>
  );
}
