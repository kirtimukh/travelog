import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  ScrollView,
  type GestureType,
} from "react-native-gesture-handler";

import { AppHeaderMenu } from "../../src/components/AppHeaderMenu";
import { HeaderBackButton } from "../../src/components/HeaderBackButton";
import { JourneyAddMediaModal } from "../../src/features/journey/components/JourneyAddMediaModal";
import { JourneyAddNoteController } from "../../src/features/journey/components/JourneyAddNoteController";
import { JourneyMapPanel } from "../../src/features/journey/components/JourneyMapPanel";
import { JourneyMediaEditModal } from "../../src/features/journey/components/JourneyMediaEditModal";
import { JourneyNoteEditModal } from "../../src/features/journey/components/JourneyNoteEditModal";
import { JourneyNotesFeed } from "../../src/features/journey/components/JourneyNotesFeed";
import { RerecordOverlayBar } from "../../src/features/journey/components/RerecordOverlayBar";
import { useJourneyControls } from "../../src/features/journey/hooks/useJourneyControls";
import { useJourneyData } from "../../src/features/journey/hooks/useJourneyData";
import { useMediaEditFlow } from "../../src/features/journey/hooks/useMediaEditFlow";
import { useNoteEditFlow } from "../../src/features/journey/hooks/useNoteEditFlow";
import { useRerecordFlow } from "../../src/features/journey/hooks/useRerecordFlow";
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

  const [noteModalVisible, setNoteModalVisible] = useState(false);

  const displayError =
    journeyData.error ??
    journeyControls.error ??
    rerecordFlow.error ??
    mediaEditFlow.addModal.error;

  const actionLabel = getJourneyActionLabel(journeyData.statusLabel);

  const mapGestureRef = useRef<GestureType | undefined>(undefined);
  const mapNativeGesture = useMemo(
    () => Gesture.Native().disallowInterruption(false).withRef(mapGestureRef),
    [],
  );

  const { endJourney, busy: controlsBusy } = journeyControls;
  const requestEndJourney = useCallback((): void => {
    if (!journeyData.statusLabel || journeyData.statusLabel === "completed" || controlsBusy) {
      return;
    }
    Alert.alert(
      "End journey?",
      `This will mark "${journeyData.name}" as complete and stop live updates.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final confirmation",
              "Ending this journey cannot be undone. End this journey now?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "End journey",
                  style: "destructive",
                  onPress: () => {
                    void (async () => {
                      await endJourney();
                      router.replace(`/journey/details/${journeyId}`);
                    })();
                  },
                },
              ],
            );
          },
        },
      ],
    );
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
        contentContainerStyle={{ paddingBottom: 24 }}
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
              void journeyControls.onJourneyActionPress();
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
            disabled={rerecordFlow.session !== null}
            onPress={() => {
              setNoteModalVisible(true);
            }}
          >
            <Text className="text-center font-semibold text-neutral-900">Add note</Text>
          </Pressable>
          <Pressable
            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            onPress={mediaEditFlow.addModal.onOpen}
          >
            <Text className="text-center font-semibold text-neutral-900">Add media</Text>
          </Pressable>
        </View>

        <JourneyNotesFeed
          notes={journeyData.notes}
          media={journeyData.media}
          locationPoints={journeyData.points}
          suspendPlayback={
            noteModalVisible ||
            noteEditFlow.target !== null ||
            rerecordFlow.session !== null
          }
          onLongPressNote={noteEditFlow.openFor}
          onLongPressMedia={mediaEditFlow.editModal.openFor}
        />
      </ScrollView>

      {rerecordFlow.session ? (
        <RerecordOverlayBar
          recorder={rerecordFlow.session.recorder}
          busy={rerecordFlow.busy}
          onStop={() => {
            void rerecordFlow.stopRerecordAndSave();
          }}
        />
      ) : null}

      {noteModalVisible ? (
        <JourneyAddNoteController
          journeyId={journeyId}
          onClose={() => {
            setNoteModalVisible(false);
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

      {noteEditFlow.target ? (
        <JourneyNoteEditModal
          visible
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
            if (!noteEditFlow.target) {
              return;
            }
            void rerecordFlow.rerecordNoteAudio(noteEditFlow.target);
            noteEditFlow.close();
          }}
        />
      ) : null}

      {mediaEditFlow.editModal.target ? (
        <JourneyMediaEditModal
          visible
          file={mediaEditFlow.editModal.target.file}
          width={mediaEditFlow.editModal.target.width}
          height={mediaEditFlow.editModal.target.height}
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
          exif={mediaEditFlow.editModal.exif}
          busy={mediaEditFlow.editModal.busy}
          onRequestClose={mediaEditFlow.editModal.close}
          onSave={() => {
            void mediaEditFlow.editModal.save();
          }}
          onDelete={() => {
            void mediaEditFlow.editModal.remove();
          }}
        />
      ) : null}
    </View>
  );
}
