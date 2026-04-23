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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { openAppDatabase } from "../../../src/db/client";
import { deleteJourneyWithFileGc } from "../../../src/db/journeys";
import { deleteMediaById, updateMediaDetails } from "../../../src/db/media";
import { deleteNoteById, updateNoteText } from "../../../src/db/notes";
import type {
  JourneyRow,
  LocationPointRow,
  MediaRow,
  NoteRow,
  WeatherRow,
} from "../../../src/db/schema";
import { unlinkIfExists } from "../../../src/files/fsCleanup";
import { loadJourneyBundle } from "../../../src/features/journey/bundle";
import { formatDurationSeconds } from "../../../src/features/journey/formatDuration";
import { JourneyMapPanel } from "../../../src/features/journey/components/JourneyMapPanel";
import { JourneyMediaEditModal } from "../../../src/features/journey/components/JourneyMediaEditModal";
import { JourneyNoteEditModal } from "../../../src/features/journey/components/JourneyNoteEditModal";
import { JourneyNotesFeed } from "../../../src/features/journey/components/JourneyNotesFeed";
import { JourneyWeatherModal } from "../../../src/features/journey/components/JourneyWeatherModal";
import {
  buildReplayEvents,
  getJourneyPauseWindows,
  getLatestReplayEvent,
  getReplayHeading,
  getReplayPointAtTimestamp,
  getReplayRecordedDurationMs,
  getStoredOrComputedJourneyDurationMs,
  mapRecordedElapsedMsToWallTs,
} from "../../../src/features/journey/replay";
import { onPermissionGranted } from "../../../src/location/currentLocationCache";
import { sumPathDistanceMeters } from "../../../src/features/journey/journeyMetrics";
import { useWeatherCaptureFlow } from "../../../src/features/journey/hooks/useWeatherCaptureFlow";
import { canEditInDetails } from "../../../src/features/journey/status";
import { useOngoingJourneyCandidate } from "../../../src/features/journey/useOngoingJourneyCandidate";
import { AppHeaderMenu } from "../../../src/components/AppHeaderMenu";
import { HeaderBackButton } from "../../../src/components/HeaderBackButton";

const NORMALIZED_REPLAY_DURATION_MS = 120_000;
const HOLD_TO_FAST_MS = 1_000;
const TAP_JUMP_MAX_MS = 500;
const FAST_HOLD_MULTIPLIER = 5;
const REPLAY_TICK_MS = 100;

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
  const [weather, setWeather] = useState<WeatherRow[]>([]);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [deleteJourneyBusy, setDeleteJourneyBusy] = useState<boolean>(false);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [holdDirection, setHoldDirection] = useState<-1 | 0 | 1>(0);
  const insets = useSafeAreaInsets();
  const [replayElapsedMs, setReplayElapsedMs] = useState<number | null>(null);
  const [replaySessionPointTs, setReplaySessionPointTs] = useState<number | null>(null);
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
  const pressedDirectionRef = useRef<-1 | 0 | 1>(0);
  const pressStartTsRef = useRef<number | null>(null);

  const latestPointTs = useMemo(() => {
    if (points.length === 0) {
      return null;
    }
    return points.reduce(
      (maxTs, point) => (point.timestamp > maxTs ? point.timestamp : maxTs),
      points[0]?.timestamp ?? 0,
    );
  }, [points]);

  useEffect(() => {
    setReplaySessionPointTs(null);
  }, [journeyId]);

  useEffect(() => {
    if (replaySessionPointTs != null || !journey?.start_ts) {
      return;
    }
    setReplaySessionPointTs(latestPointTs ?? journey.end_ts ?? journey.start_ts);
  }, [journey?.end_ts, journey?.start_ts, latestPointTs, replaySessionPointTs]);

  const replayPauseWindows = useMemo(() => getJourneyPauseWindows(journey), [journey]);
  const replayDurationMs = useMemo(
    () => getReplayRecordedDurationMs(journey, replaySessionPointTs),
    [journey, replaySessionPointTs],
  );
  const replayTs = useMemo(
    () =>
      replayElapsedMs == null
        ? null
        : mapRecordedElapsedMsToWallTs(journey, replayElapsedMs, replaySessionPointTs),
    [journey, replayElapsedMs, replaySessionPointTs],
  );
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
    setWeather(bundle.weather);
  }, [journeyId]);

  const weatherCaptureFlow = useWeatherCaptureFlow({
    journeyId,
    refreshJourneyData: refresh,
  });

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
    const granted = res.status === Location.PermissionStatus.GRANTED;
    setLocationPermission(granted);
    if (granted) {
      void onPermissionGranted();
    }
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
    if (!journey?.start_ts || replayElapsedMs != null) {
      return;
    }
    setReplayElapsedMs(0);
  }, [journey?.start_ts, replayElapsedMs]);

  useEffect(() => {
    const hasHold = holdDirection !== 0;
    if ((!isReplaying && !hasHold) || replayElapsedMs == null || replayDurationMs <= 0) {
      return;
    }
    const baseRate = replayDurationMs / NORMALIZED_REPLAY_DURATION_MS;
    const direction: -1 | 1 = hasHold ? holdDirection : 1;
    const speedMultiplier = hasHold ? FAST_HOLD_MULTIPLIER : 1;
    const intervalId = setInterval(() => {
      setReplayElapsedMs((current) => {
        if (current == null) {
          return 0;
        }
        const deltaMs = direction * baseRate * speedMultiplier * REPLAY_TICK_MS;
        const next = current + deltaMs;
        if (next >= replayDurationMs) {
          setIsReplaying(false);
          setHoldDirection(0);
          return replayDurationMs;
        }
        if (next <= 0) {
          return 0;
        }
        return next;
      });
    }, REPLAY_TICK_MS);
    return () => {
      clearInterval(intervalId);
    };
  }, [holdDirection, isReplaying, replayDurationMs, replayElapsedMs]);

  useEffect(
    () => () => {
      if (holdTimeoutRef.current != null) {
        clearTimeout(holdTimeoutRef.current);
      }
      holdActivatedRef.current = false;
      pressedDirectionRef.current = 0;
      pressStartTsRef.current = null;
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
  const canReplay =
    Boolean(journey?.start_ts) && replayDurationMs > 0 && journey?.status !== "scheduled";
  const heading = getReplayHeading(replayPoint);
  const speed = replayPoint?.speed ?? null;

  const journeyDurationMs = useMemo(
    () => getStoredOrComputedJourneyDurationMs(journey, replaySessionPointTs),
    [journey, replaySessionPointTs],
  );
  const recordedDistanceMeters = useMemo(() => {
    if (journey?.status === "completed" && journey.recorded_distance != null) {
      return journey.recorded_distance;
    }
    return sumPathDistanceMeters(points);
  }, [journey, points]);

  const clampReplayTs = useCallback(
    (value: number): number => {
      return Math.max(0, Math.min(replayDurationMs, value));
    },
    [replayDurationMs],
  );

  const skipReplayByPercent = useCallback(
    (direction: -1 | 1): void => {
      if (!canReplay) {
        return;
      }
      const stepMs = Math.max(1, Math.round(replayDurationMs * 0.05));
      setReplayElapsedMs((current) => {
        const anchor = current ?? 0;
        return clampReplayTs(anchor + direction * stepMs);
      });
    },
    [canReplay, clampReplayTs, replayDurationMs],
  );

  const handleDirectionalPressIn = useCallback(
    (direction: -1 | 1): void => {
      if (!canReplay) {
        return;
      }
      pressStartTsRef.current = Date.now();
      pressedDirectionRef.current = direction;
      holdActivatedRef.current = false;
      if (holdTimeoutRef.current != null) {
        clearTimeout(holdTimeoutRef.current);
      }
      holdTimeoutRef.current = setTimeout(() => {
        if (pressedDirectionRef.current !== direction) {
          return;
        }
        holdActivatedRef.current = true;
        setHoldDirection(direction);
      }, HOLD_TO_FAST_MS);
    },
    [canReplay],
  );

  const handleDirectionalPressOut = useCallback(
    (direction: -1 | 1): void => {
      if (holdTimeoutRef.current != null) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }
      const pressStartTs = pressStartTsRef.current;
      const pressDurationMs = pressStartTs == null ? Number.POSITIVE_INFINITY : Date.now() - pressStartTs;
      pressStartTsRef.current = null;
      pressedDirectionRef.current = 0;
      if (holdActivatedRef.current) {
        holdActivatedRef.current = false;
        setHoldDirection(0);
        return;
      }
      if (!canReplay) {
        return;
      }
      if (pressDurationMs < TAP_JUMP_MAX_MS) {
        skipReplayByPercent(direction);
      }
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
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 40) }}
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
              markerHead={replayPoint}
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
          Timestamp:{" "}
          {replayTs == null
            ? "—"
            : new Date(replayTs).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "medium",
              })}
        </Text>
        <Text className="mt-1 text-xs text-neutral-700">
          Journey duration:{" "}
          {journeyDurationMs <= 0 ? "—" : formatDurationSeconds(journeyDurationMs / 1000)}
        </Text>
        <Text className="mt-1 text-xs text-neutral-700">
          Recorded duration:{" "}
          {replayDurationMs <= 0 ? "—" : formatDurationSeconds(replayDurationMs / 1000)}
        </Text>
        <Text className="mt-1 text-xs text-neutral-700">
          Recorded distance:{" "}
          {recordedDistanceMeters <= 0 ? "—" : `${(recordedDistanceMeters / 1000).toFixed(2)} km`}
        </Text>
        <Text className="mt-1 text-xs text-neutral-700">
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
              setHoldDirection(0);
              holdActivatedRef.current = false;
              pressedDirectionRef.current = 0;
              pressStartTsRef.current = null;
              if (holdTimeoutRef.current != null) {
                clearTimeout(holdTimeoutRef.current);
                holdTimeoutRef.current = null;
              }
              setReplayElapsedMs(0);
              setEventFeed([]);
            }}
          >
            <Text className="text-center font-semibold text-white">↺</Text>
          </Pressable>
          <Pressable
            className={`min-w-12 rounded-md px-3 py-3 ${isReplaying ? "bg-amber-600" : "bg-emerald-600"}`}
            onPress={() => {
              setHoldDirection(0);
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

      {editable ? (
        <Pressable
          className="mt-4 self-stretch rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
          accessibilityLabel="Weather"
          accessibilityRole="button"
          onPress={() => {
            weatherCaptureFlow.modal.open();
          }}
        >
          <Text className="text-center text-lg font-semibold text-neutral-900">☁️</Text>
        </Pressable>
      ) : null}

      <JourneyNotesFeed
        notes={notes}
        media={media}
        weather={weather}
        pauseWindows={replayPauseWindows}
        locationPoints={points}
        editable={editable}
        suspendPlayback={
          noteEditTarget !== null ||
          mediaEditTarget !== null ||
          weatherCaptureFlow.modal.visible
        }
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
        onLongPressWeather={(row) => {
          weatherCaptureFlow.modal.openForWeather(row);
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
