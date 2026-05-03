import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  ScrollView,
  type GestureType,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeaderMenu } from "../../src/components/AppHeaderMenu";
import { HeaderBackButton } from "../../src/components/HeaderBackButton";
import { JourneyAddMediaModal } from "../../src/features/journey/components/JourneyAddMediaModal";
import { JourneyAddNoteController } from "../../src/features/journey/components/JourneyAddNoteController";
import {
  JourneyActionConfirmModal,
  type JourneyActionConfirmKind,
} from "../../src/features/journey/components/JourneyActionConfirmModal";
import { JourneyMapPanel } from "../../src/features/journey/components/JourneyMapPanel";
import { RerecordOverlayBar } from "../../src/features/journey/components/RerecordOverlayBar";
import { JourneyArtifactsEditorModals } from "../../src/features/journey/journeyArtifacts/JourneyArtifactsEditorModals";
import { JourneyArtifactsFeed } from "../../src/features/journey/journeyArtifacts/JourneyArtifactsFeed";
import { useJourneyControls } from "../../src/features/journey/hooks/useJourneyControls";
import { useJourneyData } from "../../src/features/journey/hooks/useJourneyData";
import { useMediaEditFlow } from "../../src/features/journey/hooks/useMediaEditFlow";
import { useNoteEditFlow } from "../../src/features/journey/hooks/useNoteEditFlow";
import { useRerecordFlow } from "../../src/features/journey/hooks/useRerecordFlow";
import { useScheduledMapFallbackLngLat } from "../../src/features/journey/hooks/useScheduledMapFallbackLngLat";
import { useWeatherCaptureFlow } from "../../src/features/journey/hooks/useWeatherCaptureFlow";
import { confirmTwoStepDestructiveAction } from "../../src/features/journey/confirmTwoStepDestructive";
import { getJourneyPauseWindows } from "../../src/features/journey/replay";
import { getJourneyActionLabel } from "../../src/features/journey/status";
import { useOngoingJourneyCandidate } from "../../src/features/journey/useOngoingJourneyCandidate";

export default function JourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const journeyId = Number(id);

  const journeyData = useJourneyData(journeyId);
  const { ongoingJourneyId, refreshOngoingJourney } = useOngoingJourneyCandidate();
  const journeyControls = useJourneyControls({
    journeyId,
    statusLabel: journeyData.statusLabel,
    locationPermission: journeyData.locationPermission,
    refreshJourneyData: journeyData.refreshJourneyData,
    refreshOngoingJourney,
    requestMapPermission: journeyData.requestMapPermission,
  });
  const rerecordFlow = useRerecordFlow({ refreshJourneyData: journeyData.refreshJourneyData });
  const noteEditFlow = useNoteEditFlow({ refreshJourneyData: journeyData.refreshJourneyData });
  const mediaEditFlow = useMediaEditFlow({
    journeyId,
    refreshJourneyData: journeyData.refreshJourneyData,
  });
  const weatherCaptureFlow = useWeatherCaptureFlow({
    journeyId,
    refreshJourneyData: journeyData.refreshJourneyData,
  });

  const [textNoteModalVisible, setTextNoteModalVisible] = useState(false);
  const [voiceNoteModalVisible, setVoiceNoteModalVisible] = useState(false);
  const [journeyActionConfirmOpen, setJourneyActionConfirmOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const displayError =
    journeyData.error ??
    journeyControls.error ??
    rerecordFlow.error ??
    mediaEditFlow.addModal.error;

  const actionLabel = getJourneyActionLabel(journeyData.statusLabel);
  const actionConfirmKind = useMemo((): JourneyActionConfirmKind | null => {
    const s = journeyData.statusLabel;
    if (s === "scheduled") {
      return "start";
    }
    if (s === "ongoing") {
      return "pause";
    }
    if (s === "paused") {
      return "continue";
    }
    return null;
  }, [journeyData.statusLabel]);
  const pauseWindows = useMemo(
    () => getJourneyPauseWindows(journeyData.journey),
    [journeyData.journey],
  );

  const mapGestureRef = useRef<GestureType | undefined>(undefined);
  const mapNativeGesture = useMemo(
    () => Gesture.Native().disallowInterruption(false).withRef(mapGestureRef),
    [],
  );

  const liveMapFallbackLngLat = useScheduledMapFallbackLngLat(
    journeyData.statusLabel,
    journeyData.points.length,
  );

  const { endJourney, busy: controlsBusy } = journeyControls;
  const requestEndJourney = useCallback((): void => {
    if (!journeyData.statusLabel || journeyData.statusLabel === "completed" || controlsBusy) {
      return;
    }
    confirmTwoStepDestructiveAction({
      firstTitle: "End journey?",
      firstMessage: `This will mark "${journeyData.name}" as complete and stop live updates.`,
      secondTitle: "Final confirmation",
      secondMessage: "Ending this journey cannot be undone. End this journey now?",
      finalDestructiveLabel: "End journey",
      onFinalConfirm: async () => {
        await endJourney();
        router.replace(`/journey/details/${journeyId}`);
      },
    });
  }, [controlsBusy, endJourney, journeyData.name, journeyData.statusLabel, journeyId, router]);

  useEffect(() => {
    navigation.setOptions({
      title: journeyData.name,
      headerLeft: () => <HeaderBackButton />,
      headerRight: () => (
        <AppHeaderMenu
          showHome
          showHistory
          ongoingJourneyId={ongoingJourneyId}
          hideOngoing={ongoingJourneyId === journeyId}
          onEndJourney={requestEndJourney}
          endJourneyDisabled={journeyData.statusLabel === "completed" || controlsBusy}
        />
      ),
    });
  }, [
    controlsBusy,
    journeyData.name,
    journeyData.statusLabel,
    journeyId,
    navigation,
    ongoingJourneyId,
    requestEndJourney,
  ]);

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1 px-6 pt-12"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 40) }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        waitFor={mapGestureRef}
      >
        <Text className="text-xl font-bold">{journeyData.name}</Text>
        <Text className="mt-2 text-neutral-600">Status: {journeyData.statusLabel || "—"}</Text>
        {displayError ? (
          <Text className="mt-2 text-sm text-red-700">{displayError}</Text>
        ) : null}
        {journeyData.needsBackgroundLocationSettings ? (
          <Pressable
            className="mt-3 self-start rounded-md bg-neutral-700 px-4 py-2"
            onPress={() => {
              void Linking.openSettings();
            }}
          >
            <Text className="font-semibold text-white">Open location settings</Text>
          </Pressable>
        ) : null}

        <View className="mt-4">
          <GestureDetector gesture={mapNativeGesture}>
            <View collapsable={false}>
              <JourneyMapPanel
                points={journeyData.points}
                fallbackLngLat={liveMapFallbackLngLat}
                fallbackMarkerVariant={
                  journeyData.statusLabel === "scheduled"
                    ? "scheduledCurrentLocation"
                    : "default"
                }
                hasLocationPermission={journeyData.locationPermission === "granted"}
                onGrantLocation={() => {
                  void journeyData.requestMapPermission();
                }}
              />
            </View>
          </GestureDetector>
        </View>

        {actionLabel ? (
          <Pressable
            className={`mt-4 rounded-md px-4 py-3 ${journeyControls.busy ? "bg-neutral-300" : "bg-emerald-600"}`}
            disabled={journeyControls.busy}
            onPress={() => {
              setJourneyActionConfirmOpen(true);
            }}
          >
            <Text className="text-center font-semibold text-white">
              {journeyControls.busy ? "Working..." : actionLabel}
            </Text>
          </Pressable>
        ) : null}

        <Text className="mt-2 font-mono text-sm text-neutral-500">
          id={id} | points={journeyData.points.length}
        </Text>

        <View className="mt-6 flex-row gap-3">
          <Pressable
            className={`flex-1 rounded-xl border border-neutral-200 px-4 py-3 ${rerecordFlow.session ? "bg-neutral-200" : "bg-neutral-50"}`}
            accessibilityLabel="Weather"
            accessibilityRole="button"
            onPress={() => {
              weatherCaptureFlow.modal.open();
            }}
          >
            <Text className="text-center text-lg font-semibold text-neutral-900">☁️</Text>
          </Pressable>
          <Pressable
            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            accessibilityLabel="Add media"
            accessibilityRole="button"
            onPress={mediaEditFlow.addModal.onOpen}
          >
            <Text className="text-center text-lg font-semibold text-neutral-900">📷</Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-xl border border-neutral-200 px-4 py-3 ${rerecordFlow.session ? "bg-neutral-200" : "bg-neutral-50"}`}
            disabled={rerecordFlow.session !== null}
            accessibilityLabel="Add text note"
            accessibilityRole="button"
            onPress={() => {
              setTextNoteModalVisible(true);
            }}
          >
            <Text className="text-center text-lg font-semibold text-neutral-900">T</Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-xl border border-neutral-200 px-4 py-3 ${rerecordFlow.session ? "bg-neutral-200" : "bg-neutral-50"}`}
            disabled={rerecordFlow.session !== null}
            accessibilityLabel="Add voice note"
            accessibilityRole="button"
            onPress={() => {
              setVoiceNoteModalVisible(true);
            }}
          >
            <Text className="text-center text-lg font-semibold text-neutral-900">🔴</Text>
          </Pressable>
        </View>

        <JourneyArtifactsFeed
          notes={journeyData.notes}
          media={journeyData.media}
          weather={journeyData.weather}
          pauseWindows={pauseWindows}
          locationPoints={journeyData.points}
          noteEdit={noteEditFlow}
          mediaEdit={mediaEditFlow}
          weatherCapture={weatherCaptureFlow}
          liveSuspendExtras={{
            textNoteModalVisible,
            voiceNoteModalVisible,
            rerecordSessionActive: rerecordFlow.session !== null,
            mediaAddModalVisible: mediaEditFlow.addModal.visible,
          }}
        />
      </ScrollView>

      {actionConfirmKind != null ? (
        <JourneyActionConfirmModal
          visible={journeyActionConfirmOpen}
          actionKind={actionConfirmKind}
          onCancel={() => setJourneyActionConfirmOpen(false)}
          onConfirmHoldComplete={() => {
            setJourneyActionConfirmOpen(false);
            void journeyControls.onJourneyActionPress();
          }}
        />
      ) : null}

      {rerecordFlow.session ? (
        <RerecordOverlayBar
          recorder={rerecordFlow.session.recorder}
          busy={rerecordFlow.busy}
          onStop={() => {
            void rerecordFlow.stopRerecordAndSave();
          }}
        />
      ) : null}

      {textNoteModalVisible ? (
        <JourneyAddNoteController
          journeyId={journeyId}
          mode="text"
          onClose={() => {
            setTextNoteModalVisible(false);
          }}
          onSaved={journeyData.refreshJourneyData}
        />
      ) : null}

      {voiceNoteModalVisible ? (
        <JourneyAddNoteController
          journeyId={journeyId}
          mode="voice"
          onClose={() => {
            setVoiceNoteModalVisible(false);
          }}
          onSaved={journeyData.refreshJourneyData}
        />
      ) : null}

      {mediaEditFlow.addModal.visible ? (
        <JourneyAddMediaModal
          visible
          text={mediaEditFlow.addModal.text}
          selectedFile={mediaEditFlow.addModal.selectedFile}
          selectedWidth={mediaEditFlow.addModal.selectedWidth}
          selectedHeight={mediaEditFlow.addModal.selectedHeight}
          onChangeText={mediaEditFlow.addModal.onChangeText}
          busy={mediaEditFlow.addModal.busy}
          onPickImage={() => {
            void mediaEditFlow.addModal.onPickImage();
          }}
          onSave={() => {
            void mediaEditFlow.addModal.onSave();
          }}
          onRequestClose={mediaEditFlow.addModal.onClose}
        />
      ) : null}

      <JourneyArtifactsEditorModals
        noteEdit={noteEditFlow}
        mediaEdit={mediaEditFlow}
        weatherCapture={weatherCaptureFlow}
        onRerecordAudio={() => {
          if (!noteEditFlow.target) {
            return;
          }
          void rerecordFlow.rerecordNoteAudio(noteEditFlow.target);
          noteEditFlow.close();
        }}
        weatherOnDelete={weatherCaptureFlow.modal.requestDeleteWeather}
      />
    </View>
  );
}
