import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { openAppDatabase } from "../../src/db/client";
import { updateJourneyStatus } from "../../src/db/journeys";
import {
  insertLocationPoint,
  listLocationPointsForJourney,
} from "../../src/db/locationPoints";
import {
  createMedia,
  deleteMediaById,
  updateMediaText,
} from "../../src/db/media";
import {
  createNote,
  deleteNoteById,
  updateNoteAudio,
  updateNoteText,
} from "../../src/db/notes";
import type {
  JourneyStatus,
  LocationPointRow,
  MediaRow,
  NoteRow,
} from "../../src/db/schema";
import { unlinkIfExists } from "../../src/files/fsCleanup";
import { copyImageToAppDocuments } from "../../src/files/imageCopy";
import {
  createPreparedVoiceRecorder,
  stopRecordingAndCopyToAppDocuments,
  type VoiceRecorder,
} from "../../src/files/voiceRecording";
import { syncActiveJourneySession } from "../../src/storage/activeJourney";
import { hasValidPmtilesPackage } from "../../src/storage/pmtilesGuard";
import { syncBackgroundTrackingForJourneyStatus } from "../../src/tracking/locationTracking";
import { loadJourneyBundle as loadJourneyBundleData } from "../../src/features/journey/bundle";
import { JourneyMapPanel } from "../../src/features/journey/components/JourneyMapPanel";
import { JourneyMediaList } from "../../src/features/journey/components/JourneyMediaList";
import { JourneyNotesList } from "../../src/features/journey/components/JourneyNotesList";
import { getJourneyActionLabel } from "../../src/features/journey/status";

export default function JourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const journeyId = Number(id);
  const [name, setName] = useState<string>("Journey");
  const [statusLabel, setStatusLabel] = useState<JourneyStatus | "">("");
  const [points, setPoints] = useState<LocationPointRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const [newNoteText, setNewNoteText] = useState<string>("");
  const [newMediaText, setNewMediaText] = useState<string>("");
  const [newAudioRecorder, setNewAudioRecorder] = useState<VoiceRecorder | null>(
    null,
  );
  const [newAudioPendingFile, setNewAudioPendingFile] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState<boolean>(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState<boolean>(false);
  const [needsBackgroundLocationSettings, setNeedsBackgroundLocationSettings] =
    useState<boolean>(false);

  const handleBackPress = useCallback((): void => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }, [router]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable className="px-2 py-1" onPress={handleBackPress}>
          <Text className="text-xl font-semibold text-blue-600">←</Text>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          className="px-2 py-1"
          onPress={() => {
            setShowHeaderMenu((prev) => !prev);
          }}
        >
          <Text className="text-xl font-semibold text-neutral-700">⋯</Text>
        </Pressable>
      ),
    });
  }, [handleBackPress, navigation]);

  const loadJourneyBundle = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(journeyId)) {
      return;
    }
    const bundle = await loadJourneyBundleData(journeyId);
    if (!bundle) {
      return;
    }
    const { journey, points: loadedPoints, notes: loadedNotes, media: loadedMedia } = bundle;
    setName(journey.name);
    setStatusLabel(journey.status);
    setPoints(loadedPoints);
    setNotes(loadedNotes);
    setMedia(loadedMedia);
    syncActiveJourneySession(journey.id, journey.status);
    const trackingSync = await syncBackgroundTrackingForJourneyStatus(journey.status);
    if (journey.status === "ongoing" && !trackingSync.started) {
      setNeedsBackgroundLocationSettings(
        trackingSync.permissionOutcome === "background-denied" ||
          trackingSync.permissionOutcome === "background-error",
      );
      if (trackingSync.message) {
        setScreenError(trackingSync.message);
      }
    } else {
      setNeedsBackgroundLocationSettings(false);
    }
  }, [journeyId]);

  const requestMapPermission = useCallback(async (): Promise<boolean> => {
    const res = await Location.requestForegroundPermissionsAsync();
    const granted = res.status === Location.PermissionStatus.GRANTED;
    setLocationPermission(granted ? "granted" : "denied");
    return granted;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!Number.isFinite(journeyId)) {
        return;
      }
      if (!(await hasValidPmtilesPackage())) {
        router.replace("/");
        return;
      }
      const granted = await requestMapPermission();
      if (!granted && !cancelled) {
        setScreenError("Location permission is required to render the map.");
      }
      await loadJourneyBundle();
      if (cancelled) {
        return;
      }
    })();
    return () => {
      cancelled = true;
      if (newAudioRecorder) {
        void newAudioRecorder.stop().catch(() => {});
      }
    };
  }, [journeyId, loadJourneyBundle, newAudioRecorder, requestMapPermission, router]);

  async function refreshJourneyData(): Promise<void> {
    await loadJourneyBundle();
  }

  useEffect(() => {
    if (!Number.isFinite(journeyId) || statusLabel !== "ongoing") {
      return;
    }

    const intervalId = setInterval(() => {
      void (async () => {
        const db = await openAppDatabase();
        const latestPoints = await listLocationPointsForJourney(db, journeyId);
        setPoints(latestPoints);
      })();
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [journeyId, statusLabel]);

  async function recordCurrentPointNow(): Promise<void> {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.LocationAccuracy.Balanced,
    });
    const db = await openAppDatabase();
    await insertLocationPoint(db, {
      journeyId,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      timestamp: pos.timestamp || Date.now(),
      speed: pos.coords.speed ?? null,
      metadata: null,
    });
  }

  async function onJourneyActionPress(): Promise<void> {
    if (!statusLabel || busy) {
      return;
    }
    setBusy(true);
    setScreenError(null);
    try {
      const db = await openAppDatabase();
      if (statusLabel === "scheduled") {
        const granted =
          locationPermission === "granted" ? true : await requestMapPermission();
        if (!granted) {
          throw new Error(
            "Location permission is required to start and map this journey.",
          );
        }
        await updateJourneyStatus(db, journeyId, "ongoing");
        await recordCurrentPointNow();
      } else if (statusLabel === "ongoing") {
        await updateJourneyStatus(db, journeyId, "paused");
      } else if (statusLabel === "paused") {
        await updateJourneyStatus(db, journeyId, "ongoing");
      }
      await refreshJourneyData();
    } catch (error) {
      setScreenError(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function endJourney(): Promise<void> {
    if (!statusLabel || busy || statusLabel === "completed") {
      setShowHeaderMenu(false);
      return;
    }
    setBusy(true);
    setScreenError(null);
    setShowHeaderMenu(false);
    try {
      const db = await openAppDatabase();
      await updateJourneyStatus(db, journeyId, "completed");
      await refreshJourneyData();
    } catch (error) {
      setScreenError(
        error instanceof Error ? error.message : "Could not end journey.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addTextNote(): Promise<void> {
    if (!newNoteText.trim() || busy) {
      return;
    }
    setBusy(true);
    try {
      const db = await openAppDatabase();
      await createNote(db, {
        journeyId,
        type: "text",
        text: newNoteText.trim(),
      });
      setNewNoteText("");
      await refreshJourneyData();
    } finally {
      setBusy(false);
    }
  }

  async function startNewVoiceNoteRecording(): Promise<void> {
    if (newAudioPendingFile || newAudioRecorder || busy) {
      return;
    }
    setBusy(true);
    try {
      const recorder = await createPreparedVoiceRecorder();
      await recorder.record();
      setNewAudioRecorder(recorder);
    } finally {
      setBusy(false);
    }
  }

  async function stopNewVoiceNoteRecordingAndSave(): Promise<void> {
    if (!newAudioRecorder || busy) {
      return;
    }
    setBusy(true);
    try {
      const file = await stopRecordingAndCopyToAppDocuments(newAudioRecorder);
      setNewAudioPendingFile(file);
      setNewAudioRecorder(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveNewVoiceNote(): Promise<void> {
    if (!newAudioPendingFile || busy) {
      return;
    }
    setBusy(true);
    try {
      const db = await openAppDatabase();
      await createNote(db, {
        journeyId,
        type: "voice",
        text: newNoteText.trim() || null,
        audioFile: newAudioPendingFile,
      });
      setNewNoteText("");
      setNewAudioPendingFile(null);
      await refreshJourneyData();
    } finally {
      setBusy(false);
    }
  }

  async function discardPendingVoiceRecording(): Promise<void> {
    if (!newAudioPendingFile || busy) {
      return;
    }
    setBusy(true);
    try {
      await unlinkIfExists(newAudioPendingFile);
      setNewAudioPendingFile(null);
    } finally {
      setBusy(false);
    }
  }

  async function updateNoteTextById(note: NoteRow, text: string): Promise<void> {
    const db = await openAppDatabase();
    await updateNoteText(db, note.id, text.trim() || null);
    await refreshJourneyData();
  }

  async function rerecordNoteAudio(note: NoteRow): Promise<void> {
    if (busy) {
      return;
    }
    if (note.audio_file) {
      setScreenError(
        "Discard the existing audio recording before recording a new one.",
      );
      return;
    }
    setBusy(true);
    try {
      const recorder = await createPreparedVoiceRecorder();
      await recorder.record();
      setTimeout(async () => {
        try {
          const file = await stopRecordingAndCopyToAppDocuments(recorder);
          const db = await openAppDatabase();
          await updateNoteAudio(db, note.id, file, null);
          await refreshJourneyData();
        } catch {
          setScreenError("Could not save re-recorded audio.");
        } finally {
          setBusy(false);
        }
      }, 1000);
    } catch {
      setBusy(false);
      setScreenError("Could not start voice recording.");
    }
  }

  async function discardNoteAudio(note: NoteRow): Promise<void> {
    if (!note.audio_file || busy) {
      return;
    }
    setBusy(true);
    try {
      await unlinkIfExists(note.audio_file);
      const db = await openAppDatabase();
      await updateNoteAudio(db, note.id, null, null);
      await refreshJourneyData();
    } finally {
      setBusy(false);
    }
  }

  async function deleteNote(note: NoteRow): Promise<void> {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      if (note.audio_file) {
        await unlinkIfExists(note.audio_file);
      }
      const db = await openAppDatabase();
      await deleteNoteById(db, note.id);
      await refreshJourneyData();
    } finally {
      setBusy(false);
    }
  }

  async function addImageMedia(): Promise<void> {
    if (busy) {
      return;
    }
    setBusy(true);
    setScreenError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        throw new Error("Media library permission denied.");
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]?.uri) {
        return;
      }
      const copiedFile = await copyImageToAppDocuments(picked.assets[0].uri);
      const db = await openAppDatabase();
      await createMedia(db, {
        journeyId,
        file: copiedFile,
        text: newMediaText.trim() || null,
      });
      setNewMediaText("");
      await refreshJourneyData();
    } catch (error) {
      setScreenError(
        error instanceof Error ? error.message : "Could not add image.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateMediaTextById(item: MediaRow, text: string): Promise<void> {
    const db = await openAppDatabase();
    await updateMediaText(db, item.id, text.trim() || null);
    await refreshJourneyData();
  }

  async function deleteMedia(item: MediaRow): Promise<void> {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await unlinkIfExists(item.file);
      const db = await openAppDatabase();
      await deleteMediaById(db, item.id);
      await refreshJourneyData();
    } finally {
      setBusy(false);
    }
  }

  const actionLabel = getJourneyActionLabel(statusLabel);

  return (
    <View className="flex-1 bg-white">
      {showHeaderMenu ? (
        <View className="absolute right-6 top-4 z-20 w-44 rounded-md border border-neutral-200 bg-white p-2 shadow">
          <Pressable
            className={`rounded-md px-3 py-2 ${statusLabel === "completed" || busy ? "bg-neutral-100" : "bg-white"}`}
            disabled={statusLabel === "completed" || busy}
            onPress={() => {
              void endJourney();
            }}
          >
            <Text
              className={`font-medium ${statusLabel === "completed" || busy ? "text-neutral-400" : "text-red-700"}`}
            >
              End Journey
            </Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView className="flex-1 px-6 pt-12">
      <Text className="text-xl font-bold">{name}</Text>
      <Text className="mt-2 text-neutral-600">Status: {statusLabel || "—"}</Text>
      {screenError ? (
        <Text className="mt-2 text-sm text-red-700">{screenError}</Text>
      ) : null}
      {needsBackgroundLocationSettings ? (
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
        <JourneyMapPanel
          points={points}
          hasLocationPermission={locationPermission === "granted"}
          onGrantLocation={() => {
            void requestMapPermission();
          }}
        />
      </View>
      {actionLabel ? (
        <Pressable
          className={`mt-4 rounded-md px-4 py-3 ${busy ? "bg-neutral-300" : "bg-emerald-600"}`}
          disabled={busy}
          onPress={() => {
            void onJourneyActionPress();
          }}
        >
          <Text className="text-center font-semibold text-white">
            {busy ? "Working..." : actionLabel}
          </Text>
        </Pressable>
      ) : null}
      <Text className="mt-2 font-mono text-sm text-neutral-500">
        id={id} | points={points.length}
      </Text>

      <View className="mt-6 rounded-xl border border-neutral-200 p-4">
        <Text className="text-base font-semibold text-neutral-900">Add note</Text>
        <TextInput
          className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Note text"
          value={newNoteText}
          onChangeText={setNewNoteText}
        />
        <Pressable
          className="mt-3 rounded-md bg-blue-600 px-4 py-2"
          onPress={() => {
            void addTextNote();
          }}
        >
          <Text className="text-center font-semibold text-white">Save text note</Text>
        </Pressable>
        {newAudioRecorder ? (
          <Pressable
            className="mt-3 rounded-md bg-red-600 px-4 py-2"
            onPress={() => {
              void stopNewVoiceNoteRecordingAndSave();
            }}
          >
            <Text className="text-center font-semibold text-white">
              Stop recording
            </Text>
          </Pressable>
        ) : (
          <Pressable
            className={`mt-3 rounded-md px-4 py-2 ${newAudioPendingFile ? "bg-neutral-300" : "bg-emerald-600"}`}
            disabled={Boolean(newAudioPendingFile)}
            onPress={() => {
              void startNewVoiceNoteRecording();
            }}
          >
            <Text className="text-center font-semibold text-white">
              Start voice recording
            </Text>
          </Pressable>
        )}
        {newAudioPendingFile ? (
          <View className="mt-3 gap-2">
            <Pressable
              className="rounded-md bg-emerald-700 px-4 py-2"
              onPress={() => {
                void saveNewVoiceNote();
              }}
            >
              <Text className="text-center font-semibold text-white">
                Save voice note
              </Text>
            </Pressable>
            <Pressable
              className="rounded-md bg-neutral-600 px-4 py-2"
              onPress={() => {
                void discardPendingVoiceRecording();
              }}
            >
              <Text className="text-center font-semibold text-white">
                Discard recording
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View className="mt-6 rounded-xl border border-neutral-200 p-4">
        <Text className="text-base font-semibold text-neutral-900">Add image</Text>
        <TextInput
          className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="media.text"
          value={newMediaText}
          onChangeText={setNewMediaText}
        />
        <Pressable
          className="mt-3 rounded-md bg-blue-600 px-4 py-2"
          onPress={() => {
            void addImageMedia();
          }}
        >
          <Text className="text-center font-semibold text-white">Pick image</Text>
        </Pressable>
      </View>

      <JourneyNotesList
        notes={notes}
        editable
        onUpdateText={(note, text) => {
          void updateNoteTextById(note, text);
        }}
        onDiscardAudio={(note) => {
          void discardNoteAudio(note);
        }}
        onRerecordAudio={(note) => {
          void rerecordNoteAudio(note);
        }}
        onDelete={(note) => {
          void deleteNote(note);
        }}
      />

      <JourneyMediaList
        media={media}
        editable
        onUpdateText={(item, text) => {
          void updateMediaTextById(item, text);
        }}
        onDelete={(item) => {
          void deleteMedia(item);
        }}
      />
      </ScrollView>
    </View>
  );
}
