import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Linking, Modal, Pressable, Text, TextInput, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  ScrollView,
  type GestureType,
} from "react-native-gesture-handler";

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
  NoteType,
} from "../../src/db/schema";
import { unlinkIfExists } from "../../src/files/fsCleanup";
import { copyImageToAppDocuments } from "../../src/files/imageCopy";
import {
  createPreparedVoiceRecorder,
  interruptVoiceRecording,
  stopRecordingAndCopyToAppDocuments,
  type VoiceRecorder,
} from "../../src/files/voiceRecording";
import { syncActiveJourneySession } from "../../src/storage/activeJourney";
import { hasValidPmtilesPackage } from "../../src/storage/pmtilesGuard";
import { syncBackgroundTrackingForJourneyStatus } from "../../src/tracking/locationTracking";
import { loadJourneyBundle as loadJourneyBundleData } from "../../src/features/journey/bundle";
import { JourneyMapPanel } from "../../src/features/journey/components/JourneyMapPanel";
import { JourneyAddNoteModal } from "../../src/features/journey/components/JourneyAddNoteModal";
import { JourneyMediaEditModal } from "../../src/features/journey/components/JourneyMediaEditModal";
import { JourneyNoteEditModal } from "../../src/features/journey/components/JourneyNoteEditModal";
import { JourneyNotesFeed } from "../../src/features/journey/components/JourneyNotesFeed";
import { VoiceNoteRecorderElapsed } from "../../src/features/journey/components/VoiceNoteRecorderElapsed";
import { useModalKeyboardInset } from "../../src/features/journey/hooks/useModalKeyboardInset";
import { getJourneyActionLabel } from "../../src/features/journey/status";
import { useOngoingJourneyCandidate } from "../../src/features/journey/useOngoingJourneyCandidate";
import { AppHeaderMenu } from "../../src/components/AppHeaderMenu";
import { HeaderBackButton } from "../../src/components/HeaderBackButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type VoiceNoteDraft = {
  uri: string;
  durationSeconds: number;
};

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
  const [newNoteMode, setNewNoteMode] = useState<NoteType>("text");
  const [newMediaText, setNewMediaText] = useState<string>("");
  const [newAudioRecorder, setNewAudioRecorder] = useState<VoiceRecorder | null>(
    null,
  );
  /** Latest recorder for effect cleanup on journey change / unmount only (not in effect deps). */
  const newAudioRecorderRef = useRef<VoiceRecorder | null>(null);
  newAudioRecorderRef.current = newAudioRecorder;
  const [newAudioDraft, setNewAudioDraft] = useState<VoiceNoteDraft | null>(null);
  const [rerecordSession, setRerecordSession] = useState<{
    noteId: number;
    recorder: VoiceRecorder;
  } | null>(null);
  const rerecordSessionRef = useRef<typeof rerecordSession>(null);
  rerecordSessionRef.current = rerecordSession;
  const [busy, setBusy] = useState<boolean>(false);
  const [needsBackgroundLocationSettings, setNeedsBackgroundLocationSettings] =
    useState<boolean>(false);
  const [noteModalVisible, setNoteModalVisible] = useState<boolean>(false);
  const [mediaModalVisible, setMediaModalVisible] = useState<boolean>(false);
  const [noteEditTarget, setNoteEditTarget] = useState<NoteRow | null>(null);
  const [noteEditText, setNoteEditText] = useState<string>("");
  const [mediaEditTarget, setMediaEditTarget] = useState<MediaRow | null>(null);
  const [mediaEditText, setMediaEditText] = useState<string>("");
  const { ongoingJourneyId, refreshOngoingJourney } = useOngoingJourneyCandidate();
  const modalKeyboardInset = useModalKeyboardInset();
  const insets = useSafeAreaInsets();
  const modalPaddingBottom = Math.max(insets.bottom + 16, 32);

  useEffect(() => {
    navigation.setOptions({
      title: name,
      headerLeft: () => (
        <HeaderBackButton />
      ),
      headerRight: () => (
        <AppHeaderMenu
          showHome
          showHistory
          ongoingJourneyId={ongoingJourneyId}
          hideOngoing={ongoingJourneyId === journeyId}
          onEndJourney={() => {
            void endJourney();
          }}
          endJourneyDisabled={statusLabel === "completed" || busy}
        />
      ),
    });
  }, [busy, journeyId, name, navigation, ongoingJourneyId, statusLabel]);

  useEffect(() => {
    if (noteModalVisible) {
      return;
    }
    setNewNoteText("");
    setNewNoteMode("text");
    setNewAudioDraft((prev) => {
      if (prev) {
        void unlinkIfExists(prev.uri);
      }
      return null;
    });
    setNewAudioRecorder((rec) => {
      if (rec) {
        setTimeout(() => {
          void interruptVoiceRecording(rec);
        }, 0);
      }
      return null;
    });
  }, [noteModalVisible]);

  function switchAddNoteMode(next: NoteType): void {
    if (next === "text") {
      setNewAudioDraft((prev) => {
        if (prev) {
          void unlinkIfExists(prev.uri);
        }
        return null;
      });
      setNewAudioRecorder((rec) => {
        if (rec) {
          setTimeout(() => {
            void interruptVoiceRecording(rec);
          }, 0);
        }
        return null;
      });
    } else {
      setNewNoteText("");
    }
    setNewNoteMode(next);
  }

  useEffect(() => {
    if (!mediaModalVisible) {
      setNewMediaText("");
    }
  }, [mediaModalVisible]);

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
      const rec = newAudioRecorderRef.current;
      const rerecord = rerecordSessionRef.current;
      if (rec) {
        setTimeout(() => {
          void interruptVoiceRecording(rec);
        }, 0);
      }
      if (rerecord?.recorder) {
        setTimeout(() => {
          void interruptVoiceRecording(rerecord.recorder);
        }, 0);
      }
    };
  }, [journeyId, loadJourneyBundle, requestMapPermission, router]);

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
      return;
    }
    setBusy(true);
    setScreenError(null);
    try {
      const db = await openAppDatabase();
      await updateJourneyStatus(db, journeyId, "completed");
      await refreshJourneyData();
      await refreshOngoingJourney();
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
    if (newAudioRecorder || newAudioDraft) {
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
      setNoteModalVisible(false);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Arms the journey “add voice note” flow: permission, `setAudioModeAsync` for recording,
   * `createPreparedVoiceRecorder` + `record()`, then `setNewAudioRecorder`.
   * @see voice_note_brd.md §4.1
   */
  async function startNewVoiceNoteRecording(): Promise<void> {
    if (newAudioDraft || newAudioRecorder || busy || rerecordSession) {
      return;
    }
    setBusy(true);
    setScreenError(null);
    let prepared: VoiceRecorder | null = null;
    try {
      prepared = await createPreparedVoiceRecorder();
      prepared.record();
      const armedRecorder = prepared;
      setNewAudioRecorder(armedRecorder);
      prepared = null;
    } catch (error) {
      if (prepared !== null) {
        await interruptVoiceRecording(prepared);
      }
      setScreenError(
        error instanceof Error ? error.message : "Could not start voice recording.",
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Stops capture, finalizes file (`stopRecordingAndCopyToAppDocuments`), switches session to
   * playback mode, computes `audio_duration`, sets draft for preview.
   * @see voice_note_brd.md §4.1–4.2
   */
  async function stopNewVoiceNoteRecordingAndSave(): Promise<void> {
    if (!newAudioRecorder || busy) {
      return;
    }
    const rec = newAudioRecorder;
    setBusy(true);
    setScreenError(null);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    try {
      const result = await stopRecordingAndCopyToAppDocuments(rec);
      setNewAudioDraft({
        uri: result.fileUri,
        durationSeconds: result.durationSeconds,
      });
    } catch (error) {
      setScreenError(
        error instanceof Error ? error.message : "Could not stop voice recording.",
      );
    } finally {
      setNewAudioRecorder(null);
      setBusy(false);
    }
  }

  /**
   * Persists a voice `note` row with `audio_file` and `audio_duration` (same transaction as BRD).
   */
  async function saveNewVoiceNote(): Promise<void> {
    if (!newAudioDraft || busy) {
      return;
    }
    setBusy(true);
    setScreenError(null);
    const draft = newAudioDraft;
    try {
      const db = await openAppDatabase();
      await createNote(db, {
        journeyId,
        type: "voice",
        text: null,
        audioFile: draft.uri,
        audioDurationSeconds: draft.durationSeconds,
      });
      setNewNoteText("");
      setNewAudioDraft(null);
      await refreshJourneyData();
      setNoteModalVisible(false);
    } catch (error) {
      await unlinkIfExists(draft.uri);
      setScreenError(
        error instanceof Error ? error.message : "Could not save voice note.",
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Deletes the pending copied file from disk and clears draft state.
   */
  async function discardPendingVoiceRecording(): Promise<void> {
    if (!newAudioDraft || busy) {
      return;
    }
    setBusy(true);
    try {
      await unlinkIfExists(newAudioDraft.uri);
      setNewAudioDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function updateNoteTextById(note: NoteRow, text: string): Promise<void> {
    const db = await openAppDatabase();
    await updateNoteText(db, note.id, text.trim() || null);
    await refreshJourneyData();
  }

  /**
   * For a voice note missing `audio_file`, starts capture; user stops via `stopRerecordAndSave`.
   * @see voice_note_brd.md §4.1
   */
  async function rerecordNoteAudio(note: NoteRow): Promise<void> {
    if (busy || rerecordSession || newAudioRecorder || newAudioDraft) {
      return;
    }
    if (note.audio_file) {
      setScreenError("This note already has audio. Delete the note to record again.");
      return;
    }
    setBusy(true);
    setScreenError(null);
    let prepared: VoiceRecorder | null = null;
    try {
      prepared = await createPreparedVoiceRecorder();
      prepared.record();
      setRerecordSession({ noteId: note.id, recorder: prepared });
      prepared = null;
    } catch (error) {
      if (prepared !== null) {
        await interruptVoiceRecording(prepared);
      }
      setScreenError(
        error instanceof Error ? error.message : "Could not start re-recording.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function stopRerecordAndSave(): Promise<void> {
    if (!rerecordSession || busy) {
      return;
    }
    const { recorder, noteId } = rerecordSession;
    setRerecordSession(null);
    setBusy(true);
    setScreenError(null);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    let copiedFile: string | null = null;
    try {
      const { fileUri, durationSeconds } = await stopRecordingAndCopyToAppDocuments(
        recorder,
      );
      copiedFile = fileUri;
      const db = await openAppDatabase();
      await updateNoteAudio(db, noteId, fileUri, null, durationSeconds);
      await refreshJourneyData();
    } catch (error) {
      if (copiedFile) {
        await unlinkIfExists(copiedFile);
      }
      setScreenError(
        error instanceof Error ? error.message : "Could not save re-recorded audio.",
      );
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
      setMediaModalVisible(false);
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
  const mapGestureRef = useRef<GestureType | undefined>(undefined);
  const mapNativeGesture = useMemo(
    () =>
      Gesture.Native()
        .disallowInterruption(false)
        .withRef(mapGestureRef),
    [],
  );

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1 px-6 pt-12"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        waitFor={mapGestureRef}
      >
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
          <GestureDetector gesture={mapNativeGesture}>
            <View collapsable={false}>
              <JourneyMapPanel
                points={points}
                hasLocationPermission={locationPermission === "granted"}
                onGrantLocation={() => {
                  void requestMapPermission();
                }}
              />
            </View>
          </GestureDetector>
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

        <View className="mt-6 flex-row gap-3">
          <Pressable
            className={`flex-1 rounded-xl border border-neutral-200 px-4 py-3 ${rerecordSession ? "bg-neutral-200" : "bg-neutral-50"}`}
            disabled={rerecordSession !== null}
            onPress={() => {
              setNoteModalVisible(true);
            }}
          >
            <Text className="text-center font-semibold text-neutral-900">Add note</Text>
          </Pressable>
          <Pressable
            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            onPress={() => {
              setMediaModalVisible(true);
            }}
          >
            <Text className="text-center font-semibold text-neutral-900">Add media</Text>
          </Pressable>
        </View>

        {newAudioRecorder === null ? (
          <JourneyNotesFeed
            notes={notes}
            media={media}
            locationPoints={points}
            suspendPlayback={
              noteModalVisible || noteEditTarget !== null || rerecordSession !== null
            }
            onLongPressNote={(note) => {
              setNoteEditTarget(note);
              setNoteEditText(note.text ?? "");
            }}
            onLongPressMedia={(item) => {
              setMediaEditTarget(item);
              setMediaEditText(item.text ?? "");
            }}
          />
        ) : null}
      </ScrollView>

      {rerecordSession ? (
        <View
          className="border-t border-neutral-200 bg-white px-4 pt-3 shadow-md"
          style={{ paddingBottom: Math.max(insets.bottom + 12, 20) }}
        >
          <Text className="text-center text-sm font-semibold text-neutral-900">
            Re-recording voice note
          </Text>
          <VoiceNoteRecorderElapsed recorder={rerecordSession.recorder} />
          <Pressable
            className={`mt-2 rounded-md px-4 py-3 ${busy ? "bg-neutral-300" : "bg-red-600"}`}
            disabled={busy}
            onPress={() => {
              void stopRerecordAndSave();
            }}
          >
            <Text className="text-center font-semibold text-white">
              {busy ? "Working…" : "Stop and save"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {
        noteModalVisible ? 
        <JourneyAddNoteModal
          visible={noteModalVisible}
          modalPaddingBottom={modalPaddingBottom}
          modalKeyboardInset={modalKeyboardInset}
          newNoteMode={newNoteMode}
          newNoteText={newNoteText}
          newAudioRecorder={newAudioRecorder}
          newAudioDraft={newAudioDraft}
          busy={busy}
          onClose={() => {
            setNoteModalVisible(false);
          }}
          onSwitchAddNoteMode={switchAddNoteMode}
          onChangeNewNoteText={setNewNoteText}
          onAddTextNote={() => {
            void addTextNote();
          }}
          onStartVoiceRecording={() => {
            void startNewVoiceNoteRecording();
          }}
          onStopVoiceRecording={() => {
            void stopNewVoiceNoteRecordingAndSave();
          }}
          onSaveVoiceNote={() => {
            void saveNewVoiceNote();
          }}
          onDiscardVoiceRecording={() => {
            void discardPendingVoiceRecording();
          }}
        />
        : null
      }

      <Modal
        transparent
        visible={mediaModalVisible}
        animationType="slide"
        onRequestClose={() => {
          setMediaModalVisible(false);
        }}
      >
        <View className="flex-1">
          <View className="flex-1 justify-end">
            <Pressable
              className="absolute inset-0 bg-black/50"
              onPress={() => {
                Keyboard.dismiss();
                setMediaModalVisible(false);
              }}
            />
            <View
              className="rounded-t-2xl border-t border-neutral-200 bg-white px-4 pt-4"
              style={{
                paddingBottom: modalPaddingBottom,
                transform: [{ translateY: -modalKeyboardInset }],
              }}
            >
              <Text className="text-base font-semibold text-neutral-900">Add media</Text>
              <TextInput
                className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm"
                placeholder="Caption (optional)"
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
          </View>
        </View>
      </Modal>

      {
        noteEditTarget !== null ? 
        <JourneyNoteEditModal
          visible={noteEditTarget !== null}
          note={noteEditTarget}
          text={noteEditText}
          onChangeText={setNoteEditText}
          busy={busy}
          keyboardInset={modalKeyboardInset}
          onRequestClose={() => {
            setNoteEditTarget(null);
          }}
          onSave={() => {
            if (!noteEditTarget || noteEditTarget.type !== "text") {
              return;
            }
            void updateNoteTextById(noteEditTarget, noteEditText).then(() => {
              setNoteEditTarget(null);
            });
          }}
          onDelete={() => {
            if (!noteEditTarget) {
              return;
            }
            void deleteNote(noteEditTarget).then(() => {
              setNoteEditTarget(null);
            });
          }}
          onRerecordAudio={() => {
            if (!noteEditTarget) {
              return;
            }
            void rerecordNoteAudio(noteEditTarget);
            setNoteEditTarget(null);
          }}
        />
        : null
      }
      

      <JourneyMediaEditModal
        visible={mediaEditTarget !== null}
        text={mediaEditText}
        onChangeText={setMediaEditText}
        busy={busy}
        keyboardInset={modalKeyboardInset}
        onRequestClose={() => {
          setMediaEditTarget(null);
        }}
        onSave={() => {
          if (!mediaEditTarget) {
            return;
          }
          void updateMediaTextById(mediaEditTarget, mediaEditText).then(() => {
            setMediaEditTarget(null);
          });
        }}
        onDelete={() => {
          if (!mediaEditTarget) {
            return;
          }
          void deleteMedia(mediaEditTarget).then(() => {
            setMediaEditTarget(null);
          });
        }}
      />
    </View>
  );
}
