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
import { deleteMediaById, updateMediaDetails } from "../../../src/db/media";
import { deleteNoteById, updateNoteText } from "../../../src/db/notes";
import type { JourneyRow, LocationPointRow, MediaRow, NoteRow } from "../../../src/db/schema";
import { unlinkIfExists } from "../../../src/files/fsCleanup";
import { loadJourneyBundle } from "../../../src/features/journey/bundle";
import { JourneyMapPanel } from "../../../src/features/journey/components/JourneyMapPanel";
import { JourneyMediaEditModal } from "../../../src/features/journey/components/JourneyMediaEditModal";
import { JourneyNoteEditModal } from "../../../src/features/journey/components/JourneyNoteEditModal";
import { JourneyNotesFeed } from "../../../src/features/journey/components/JourneyNotesFeed";
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
  const [scrubDirection, setScrubDirection] = useState<-1 | 0 | 1>(0);
  const [replayTs, setReplayTs] = useState<number | null>(null);
  const [eventFeed, setEventFeed] = useState<string[]>([]);
  const eventScrollRef = useRef<RNScrollView | null>(null);
  const [noteEditTarget, setNoteEditTarget] = useState<NoteRow | null>(null);
  const [noteEditText, setNoteEditText] = useState<string>("");
  const [mediaEditTarget, setMediaEditTarget] = useState<MediaRow | null>(null);
  const [mediaEditText, setMediaEditText] = useState<string>("");
  const [mediaEditEpochTs, setMediaEditEpochTs] = useState<string>("");
  const [mediaEditLocalTs, setMediaEditLocalTs] = useState<string>("");
  const [mediaEditLat, setMediaEditLat] = useState<string>("");
  const [mediaEditLng, setMediaEditLng] = useState<string>("");
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdActivatedRef = useRef<boolean>(false);

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
    const hasFastScrub = scrubDirection !== 0;
    if ((!isReplaying && !hasFastScrub) || !replayBounds || replayTs == null) {
      return;
    }
    const tickMs = 100;
    const replayRate = hasFastScrub ? 5 : 1;
    const direction: -1 | 1 = hasFastScrub ? scrubDirection : 1;
    const intervalId = setInterval(() => {
      setReplayTs((current) => {
        if (current == null) {
          return replayBounds.startTs;
        }
        const deltaMs = direction * replayRate * tickMs;
        const next = current + deltaMs;
        if (next >= replayBounds.endTs) {
          setIsReplaying(false);
          setScrubDirection(0);
          return replayBounds.endTs;
        }
        if (next <= replayBounds.startTs) {
          setScrubDirection(0);
          return replayBounds.startTs;
        }
        return next;
      });
    }, tickMs);
    return () => {
      clearInterval(intervalId);
    };
  }, [isReplaying, replayBounds, replayTs, scrubDirection]);

  useEffect(
    () => () => {
      if (holdTimeoutRef.current != null) {
        clearTimeout(holdTimeoutRef.current);
      }
    },
    [],
  );

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
    const parsedEpoch = Number(mediaEditEpochTs.trim());
    const epochValue =
      mediaEditEpochTs.trim().length > 0 && Number.isFinite(parsedEpoch) ? parsedEpoch : null;
    const localValue = (() => {
      const trimmed = mediaEditLocalTs.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Date.parse(trimmed.replace(" ", "T"));
      return Number.isFinite(parsed) ? parsed : null;
    })();
    const parseGeo = (value: string, existing: number | null): number | null => {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : existing;
    };
    const db = await openAppDatabase();
    await updateMediaDetails(db, item.id, {
      text: text.trim() || null,
      timestamp: localValue ?? epochValue ?? null,
      lat: parseGeo(mediaEditLat, item.lat),
      lng: parseGeo(mediaEditLng, item.lng),
    });
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
  const replayDurationMs = replayBounds ? replayBounds.endTs - replayBounds.startTs : 0;

  const clampReplayTs = useCallback(
    (value: number): number => {
      if (!replayBounds) {
        return value;
      }
      return Math.max(replayBounds.startTs, Math.min(replayBounds.endTs, value));
    },
    [replayBounds],
  );

  const skipReplayByPercent = useCallback(
    (direction: -1 | 1): void => {
      if (!replayBounds) {
        return;
      }
      const stepMs = Math.max(1000, Math.round(replayDurationMs * 0.05));
      setReplayTs((current) => {
        const anchor = current ?? replayBounds.startTs;
        return clampReplayTs(anchor + direction * stepMs);
      });
    },
    [clampReplayTs, replayBounds, replayDurationMs],
  );

  const handleDirectionalPressIn = useCallback(
    (direction: -1 | 1): void => {
      if (!canReplay) {
        return;
      }
      setIsReplaying(false);
      skipReplayByPercent(direction);
      holdActivatedRef.current = false;
      if (holdTimeoutRef.current != null) {
        clearTimeout(holdTimeoutRef.current);
      }
      holdTimeoutRef.current = setTimeout(() => {
        holdActivatedRef.current = true;
        setScrubDirection(direction);
      }, 1000);
    },
    [canReplay, skipReplayByPercent],
  );

  const handleDirectionalPressOut = useCallback(
    (direction: -1 | 1): void => {
      if (holdTimeoutRef.current != null) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }
      if (holdActivatedRef.current) {
        holdActivatedRef.current = false;
        setScrubDirection(0);
        return;
      }
      if (!canReplay) {
        return;
      }
      skipReplayByPercent(direction);
    },
    [canReplay, skipReplayByPercent],
  );

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

      <View className="mt-3 rounded-xl border border-neutral-200 p-3">
        <Text className="text-xs text-neutral-700">
          Speed: {speed == null ? "—" : `${(speed * 3.6).toFixed(2)} km/h`}
        </Text>
        <Text className="mt-1 text-xs text-neutral-700">
          Heading: {heading == null ? "—" : `${heading.toFixed(2)} deg`}
        </Text>
      </View>

      {!canReplay ? (
        <Text className="mt-3 text-sm text-neutral-600">
          Replay is unavailable for scheduled journeys.
        </Text>
      ) : (
        <View className="mt-4 flex-row items-center gap-2">
          <Pressable
            className="min-w-12 rounded-md bg-neutral-700 px-3 py-3"
            onPressIn={() => {
              handleDirectionalPressIn(-1);
            }}
            onPressOut={() => {
              handleDirectionalPressOut(-1);
            }}
          >
            <Text className="text-center font-semibold text-white">{"<<"}</Text>
          </Pressable>
          <Pressable
            className="min-w-12 rounded-md bg-amber-700 px-3 py-3"
            onPress={() => {
              setIsReplaying(false);
              setScrubDirection(0);
              holdActivatedRef.current = false;
              if (holdTimeoutRef.current != null) {
                clearTimeout(holdTimeoutRef.current);
                holdTimeoutRef.current = null;
              }
              setReplayTs(replayBounds?.startTs ?? null);
              setEventFeed([]);
            }}
          >
            <Text className="text-center font-semibold text-white">↺</Text>
          </Pressable>
          <Pressable
            className={`min-w-12 rounded-md px-3 py-3 ${isReplaying ? "bg-amber-600" : "bg-emerald-600"}`}
            onPress={() => {
              setScrubDirection(0);
              setIsReplaying((current) => !current);
            }}
          >
            <Text className="text-center font-semibold text-white">{isReplaying ? "||" : "▶"}</Text>
          </Pressable>
          <Pressable
            className="min-w-12 rounded-md bg-neutral-700 px-3 py-3"
            onPressIn={() => {
              handleDirectionalPressIn(1);
            }}
            onPressOut={() => {
              handleDirectionalPressOut(1);
            }}
          >
            <Text className="text-center font-semibold text-white">{">>"}</Text>
          </Pressable>
        </View>
      )}

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
        suspendPlayback={noteEditTarget !== null || mediaEditTarget !== null}
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
          setMediaEditEpochTs(item.timestamp != null ? String(item.timestamp) : "");
          setMediaEditLocalTs(
            item.timestamp != null
              ? new Date(item.timestamp).toISOString().replace("T", " ").slice(0, 19)
              : "",
          );
          setMediaEditLat(item.lat != null ? String(item.lat) : "");
          setMediaEditLng(item.lng != null ? String(item.lng) : "");
        }}
      />

      <JourneyNoteEditModal
        visible={noteEditTarget !== null}
        note={noteEditTarget}
        text={noteEditText}
        onChangeText={setNoteEditText}
        busy={busy}
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
        file={mediaEditTarget?.file ?? ""}
        width={mediaEditTarget?.width ?? null}
        height={mediaEditTarget?.height ?? null}
        text={mediaEditText}
        onChangeText={setMediaEditText}
        timestampEpochMs={mediaEditEpochTs}
        onChangeTimestampEpochMs={setMediaEditEpochTs}
        localDateTime={mediaEditLocalTs}
        onChangeLocalDateTime={setMediaEditLocalTs}
        lat={mediaEditLat}
        onChangeLat={setMediaEditLat}
        lng={mediaEditLng}
        onChangeLng={setMediaEditLng}
        exif={mediaEditTarget?.exif ?? null}
        busy={busy}
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
