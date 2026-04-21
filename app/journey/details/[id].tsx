import * as Location from "expo-location";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView as RNScrollView,
  Text,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  ScrollView,
  type GestureType,
} from "react-native-gesture-handler";

import { openAppDatabase } from "../../../src/db/client";
import { deleteJourneyWithFileGc } from "../../../src/db/journeys";
import { deleteMediaById, updateMediaText } from "../../../src/db/media";
import { deleteNoteById, updateNoteText } from "../../../src/db/notes";
import type { JourneyRow, LocationPointRow, MediaRow, NoteRow } from "../../../src/db/schema";
import { unlinkIfExists } from "../../../src/files/fsCleanup";
import { loadJourneyBundle } from "../../../src/features/journey/bundle";
import { JourneyMapPanel } from "../../../src/features/journey/components/JourneyMapPanel";
import { JourneyMediaEditModal } from "../../../src/features/journey/components/JourneyMediaEditModal";
import { JourneyNoteEditModal } from "../../../src/features/journey/components/JourneyNoteEditModal";
import { JourneyNotesFeed } from "../../../src/features/journey/components/JourneyNotesFeed";
import { useModalKeyboardInset } from "../../../src/features/journey/hooks/useModalKeyboardInset";
import {
  buildReplayEvents,
  getLatestReplayEvent,
  getReplayHeading,
  getReplayPointAtTimestamp,
  getReplayTimeBounds,
} from "../../../src/features/journey/replay";
import { canEditInDetails } from "../../../src/features/journey/status";
import { useOngoingJourneyCandidate } from "../../../src/features/journey/useOngoingJourneyCandidate";
import { AppHeaderMenu } from "../../../src/components/AppHeaderMenu";
import { HeaderBackButton } from "../../../src/components/HeaderBackButton";

export default function JourneyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const journeyId = Number(id);
  const { ongoingJourneyId, refreshOngoingJourney } = useOngoingJourneyCandidate();

  const [journey, setJourney] = useState<JourneyRow | null>(null);
  const [points, setPoints] = useState<LocationPointRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [deleteJourneyBusy, setDeleteJourneyBusy] = useState<boolean>(false);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayTs, setReplayTs] = useState<number | null>(null);
  const [eventFeed, setEventFeed] = useState<string[]>([]);
  const eventScrollRef = useRef<RNScrollView | null>(null);
  const [noteEditTarget, setNoteEditTarget] = useState<NoteRow | null>(null);
  const [noteEditText, setNoteEditText] = useState<string>("");
  const [mediaEditTarget, setMediaEditTarget] = useState<MediaRow | null>(null);
  const [mediaEditText, setMediaEditText] = useState<string>("");
  const modalKeyboardInset = useModalKeyboardInset();

  const replayBounds = useMemo(() => getReplayTimeBounds(journey, Date.now()), [journey]);
  const replayEvents = useMemo(() => buildReplayEvents(notes, media), [media, notes]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(journeyId)) {
      return;
    }
    const bundle = await loadJourneyBundle(journeyId);
    if (!bundle) {
      return;
    }
    setJourney(bundle.journey);
    setPoints(bundle.points);
    setNotes(bundle.notes);
    setMedia(bundle.media);
  }, [journeyId]);

  const requestDeleteJourney = useCallback((): void => {
    if (!journey || deleteJourneyBusy || !Number.isFinite(journeyId)) {
      return;
    }
    Alert.alert(
      "Delete journey?",
      `This will remove "${journey.name}" and all associated notes, media, and location points.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final confirmation",
              "This action is permanent and cannot be undone. Delete this journey now?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete permanently",
                  style: "destructive",
                  onPress: () => {
                    void (async () => {
                      setDeleteJourneyBusy(true);
                      setScreenError(null);
                      try {
                        const db = await openAppDatabase();
                        await deleteJourneyWithFileGc(db, journeyId);
                        await refreshOngoingJourney();
                        router.replace("/journeys");
                      } catch {
                        setScreenError("Failed to delete journey.");
                      } finally {
                        setDeleteJourneyBusy(false);
                      }
                    })();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [deleteJourneyBusy, journey, journeyId, refreshOngoingJourney, router]);

  const requestPermission = useCallback(async (): Promise<void> => {
    const res = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(res.status === Location.PermissionStatus.GRANTED);
  }, []);

  useEffect(() => {
    void requestPermission();
    void refresh();
  }, [refresh, requestPermission]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View className="max-w-[72%] flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="shrink text-base font-semibold text-neutral-900"
          >
            {journey?.name ?? "Journey"}
          </Text>
          <View className="rounded-full bg-emerald-100 px-2 py-0.5">
            <Text className="text-xs font-semibold uppercase text-emerald-800">
              Complete
            </Text>
          </View>
        </View>
      ),
      headerLeft: () => <HeaderBackButton />,
      headerRight: () => (
        <AppHeaderMenu
          showHome
          showHistory
          ongoingJourneyId={ongoingJourneyId}
          hideOngoing={ongoingJourneyId === journeyId}
          onDeleteJourney={requestDeleteJourney}
          deleteJourneyDisabled={busy || deleteJourneyBusy}
        />
      ),
    });
  }, [
    busy,
    deleteJourneyBusy,
    journey,
    journeyId,
    navigation,
    ongoingJourneyId,
    requestDeleteJourney,
  ]);

  useEffect(() => {
    if (!replayBounds || replayTs != null) {
      return;
    }
    setReplayTs(replayBounds.startTs);
  }, [replayBounds, replayTs]);

  useEffect(() => {
    if (!isReplaying || !replayBounds || replayTs == null) {
      return;
    }
    const intervalId = setInterval(() => {
      setReplayTs((current) => {
        if (current == null) {
          return replayBounds.startTs;
        }
        const next = current + 1000;
        if (next >= replayBounds.endTs) {
          setIsReplaying(false);
          return replayBounds.endTs;
        }
        return next;
      });
    }, 150);
    return () => {
      clearInterval(intervalId);
    };
  }, [isReplaying, replayBounds, replayTs]);

  useEffect(() => {
    if (replayTs == null) {
      return;
    }
    const currentEvent = getLatestReplayEvent(replayEvents, replayTs);
    if (!currentEvent) {
      return;
    }
    setEventFeed((existing) => {
      const last = existing[existing.length - 1];
      if (last === currentEvent.text) {
        return existing;
      }
      return [...existing, currentEvent.text];
    });
  }, [replayEvents, replayTs]);

  useEffect(() => {
    eventScrollRef.current?.scrollToEnd({ animated: true });
  }, [eventFeed]);

  async function updateNoteTextById(note: NoteRow, text: string): Promise<void> {
    const db = await openAppDatabase();
    await updateNoteText(db, note.id, text.trim() || null);
    await refresh();
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
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateMediaTextById(item: MediaRow, text: string): Promise<void> {
    const db = await openAppDatabase();
    await updateMediaText(db, item.id, text.trim() || null);
    await refresh();
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
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const replayPoint = useMemo(
    () => (replayTs == null ? null : getReplayPointAtTimestamp(points, replayTs)),
    [points, replayTs],
  );
  const replayPath = useMemo(
    () => points.filter((point) => replayTs != null && point.timestamp <= replayTs),
    [points, replayTs],
  );
  const editable = canEditInDetails(journey?.status ?? "");
  const canReplay = Boolean(replayBounds) && journey?.status !== "scheduled";
  const heading = getReplayHeading(replayPoint);
  const speed = replayPoint?.speed ?? null;

  const mapGestureRef = useRef<GestureType | undefined>(undefined);
  const mapNativeGesture = useMemo(
    () =>
      Gesture.Native()
        .disallowInterruption(false)
        .withRef(mapGestureRef),
    [],
  );

  return (
    <ScrollView
      className="flex-1 bg-white px-6 pt-12"
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      waitFor={mapGestureRef}
    >
      <Text className="text-xl font-bold">{journey?.name ?? "Journey details"}</Text>
      <Text className="mt-2 text-neutral-600">Status: {journey?.status ?? "—"}</Text>
      {screenError ? <Text className="mt-2 text-sm text-red-700">{screenError}</Text> : null}

      <View className="mt-4">
        <GestureDetector gesture={mapNativeGesture}>
          <View collapsable={false}>
            <JourneyMapPanel
              points={replayPath}
              hasLocationPermission={locationPermission}
              onGrantLocation={() => {
                void requestPermission();
              }}
            />
          </View>
        </GestureDetector>
      </View>

      {!canReplay ? (
        <Text className="mt-3 text-sm text-neutral-600">
          Replay is unavailable for scheduled journeys.
        </Text>
      ) : (
        <View className="mt-4 flex-row gap-2">
          <Pressable
            className={`flex-1 rounded-md px-4 py-3 ${isReplaying ? "bg-neutral-300" : "bg-emerald-600"}`}
            disabled={isReplaying}
            onPress={() => {
              setIsReplaying(true);
            }}
          >
            <Text className="text-center font-semibold text-white">Replay</Text>
          </Pressable>
          <Pressable
            className="flex-1 rounded-md bg-amber-600 px-4 py-3"
            onPress={() => {
              setIsReplaying(false);
            }}
          >
            <Text className="text-center font-semibold text-white">Pause</Text>
          </Pressable>
          <Pressable
            className="flex-1 rounded-md bg-neutral-700 px-4 py-3"
            onPress={() => {
              setIsReplaying(false);
              setReplayTs(replayBounds?.startTs ?? null);
              setEventFeed([]);
            }}
          >
            <Text className="text-center font-semibold text-white">Reset</Text>
          </Pressable>
        </View>
      )}

      <View className="mt-3 rounded-xl border border-neutral-200 p-3">
        <Text className="text-xs text-neutral-700">
          Replay speed: {speed == null ? "—" : speed.toFixed(2)} m/s
        </Text>
        <Text className="mt-1 text-xs text-neutral-700">
          Replay heading: {heading == null ? "—" : heading.toFixed(2)} deg
        </Text>
      </View>

      <View className="mt-4 rounded-xl border border-neutral-200 p-3">
        <Text className="text-sm font-semibold text-neutral-800">Replay events</Text>
        <RNScrollView
          ref={eventScrollRef}
          className="mt-2 max-h-24"
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {eventFeed.length === 0 ? (
            <Text className="text-xs text-neutral-500">No event at current replay time.</Text>
          ) : (
            eventFeed.map((entry, index) => (
              <Text key={`${entry}-${index}`} className="mb-1 text-xs text-neutral-700">
                {entry}
              </Text>
            ))
          )}
        </RNScrollView>
      </View>

      {!editable ? (
        <Text className="mt-4 text-sm text-neutral-600">
          Editing notes/media is disabled while journey is ongoing.
        </Text>
      ) : null}

      <JourneyNotesFeed
        notes={notes}
        media={media}
        locationPoints={points}
        editable={editable}
        onLongPressNote={(note) => {
          if (!editable) {
            return;
          }
          setNoteEditTarget(note);
          setNoteEditText(note.text ?? "");
        }}
        onLongPressMedia={(item) => {
          if (!editable) {
            return;
          }
          setMediaEditTarget(item);
          setMediaEditText(item.text ?? "");
        }}
      />

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
          setScreenError("Re-recording is only available on the live journey screen.");
          setNoteEditTarget(null);
        }}
      />

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
    </ScrollView>
  );
}
