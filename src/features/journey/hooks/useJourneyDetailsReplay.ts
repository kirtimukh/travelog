import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { ScrollView as RNScrollView } from "react-native";
import { Gesture, type GestureType } from "react-native-gesture-handler";

import type { JourneyRow, LocationPointRow, MediaRow, NoteRow, WeatherRow } from "../../../db/schema";
import { sumPathDistanceMeters } from "../journeyMetrics";
import {
  buildReplayTimeline,
  getJourneyPauseWindows,
  getLatestReplayTimelineEntry,
  getReplayHeading,
  getReplayPointAtTimestamp,
  getReplayRecordedDurationMs,
  getStoredOrComputedJourneyDurationMs,
  mapRecordedElapsedMsToWallTs,
  replayTimelineEntryKey,
  type ReplayTimelineEntry,
} from "../replay";

const NORMALIZED_REPLAY_DURATION_MS = 120_000;
const HOLD_TO_FAST_MS = 1_000;
const TAP_JUMP_MAX_MS = 500;
const FAST_HOLD_MULTIPLIER = 5;
const REPLAY_TICK_MS = 100;
const REPLAY_CARD_VISIBLE_MS = 3_000;
const MAX_REPLAY_CARDS = 5;

type Params = {
  journeyId: number;
  journey: JourneyRow | null;
  points: LocationPointRow[];
  notes: NoteRow[];
  media: MediaRow[];
  weather: WeatherRow[];
};

export type ReplayCard = {
  reactKey: string;
  entry: ReplayTimelineEntry;
};

export type UseJourneyDetailsReplayResult = {
  replayPauseWindows: ReturnType<typeof getJourneyPauseWindows>;
  replayDurationMs: number;
  replayTs: number | null;
  replayElapsedMs: number | null;
  setReplayElapsedMs: Dispatch<SetStateAction<number | null>>;
  replayPoint: LocationPointRow | null;
  replayPath: LocationPointRow[];
  canReplay: boolean;
  heading: number | null;
  speed: number | null;
  journeyDurationMs: number;
  recordedDistanceMeters: number;
  isReplaying: boolean;
  setIsReplaying: Dispatch<SetStateAction<boolean>>;
  setHoldDirection: Dispatch<SetStateAction<-1 | 0 | 1>>;
  replayCards: ReplayCard[];
  eventScrollRef: RefObject<RNScrollView | null>;
  mapGestureRef: RefObject<GestureType | undefined>;
  mapNativeGesture: ReturnType<typeof Gesture.Native>;
  handleDirectionalPressIn: (direction: -1 | 1) => void;
  handleDirectionalPressOut: (direction: -1 | 1) => void;
  resetReplayControls: () => void;
  holdTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  holdActivatedRef: MutableRefObject<boolean>;
  pressedDirectionRef: MutableRefObject<-1 | 0 | 1>;
};

export function useJourneyDetailsReplay({
  journeyId,
  journey,
  points,
  notes,
  media,
  weather,
}: Params): UseJourneyDetailsReplayResult {
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [holdDirection, setHoldDirection] = useState<-1 | 0 | 1>(0);
  const [replayElapsedMs, setReplayElapsedMs] = useState<number | null>(null);
  const [replaySessionPointTs, setReplaySessionPointTs] = useState<number | null>(null);
  const [replayCards, setReplayCards] = useState<ReplayCard[]>([]);
  const eventScrollRef = useRef<RNScrollView | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdActivatedRef = useRef<boolean>(false);
  const pressedDirectionRef = useRef<-1 | 0 | 1>(0);
  const pressStartTsRef = useRef<number | null>(null);
  const cardTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastEnqueuedTimelineKeyRef = useRef<string | null>(null);
  const prevReplayElapsedMsRef = useRef<number | null>(null);
  const replayCardKeyCounterRef = useRef(0);

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
  const replayTimeline = useMemo(
    () => buildReplayTimeline(notes, media, weather),
    [media, notes, weather],
  );

  const clearReplayCardStack = useCallback(() => {
    cardTimeoutsRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    cardTimeoutsRef.current.clear();
    lastEnqueuedTimelineKeyRef.current = null;
    setReplayCards([]);
  }, []);

  useEffect(() => {
    clearReplayCardStack();
  }, [journeyId, clearReplayCardStack]);

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
      cardTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      cardTimeoutsRef.current.clear();
      holdActivatedRef.current = false;
      pressedDirectionRef.current = 0;
      pressStartTsRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (replayElapsedMs == null) {
      prevReplayElapsedMsRef.current = null;
      return;
    }
    const prev = prevReplayElapsedMsRef.current;
    prevReplayElapsedMsRef.current = replayElapsedMs;
    if (prev != null && replayElapsedMs < prev) {
      clearReplayCardStack();
    }
  }, [replayElapsedMs, clearReplayCardStack]);

  useEffect(() => {
    if (replayTs == null) {
      return;
    }
    const latest = getLatestReplayTimelineEntry(replayTimeline, replayTs);
    if (!latest) {
      return;
    }
    const timelineKey = replayTimelineEntryKey(latest);
    if (timelineKey === lastEnqueuedTimelineKeyRef.current) {
      return;
    }
    lastEnqueuedTimelineKeyRef.current = timelineKey;
    replayCardKeyCounterRef.current += 1;
    const reactKey = `replay-card-${replayCardKeyCounterRef.current}`;
    const timeoutId = setTimeout(() => {
      cardTimeoutsRef.current.delete(reactKey);
      setReplayCards((current) => current.filter((card) => card.reactKey !== reactKey));
    }, REPLAY_CARD_VISIBLE_MS);
    cardTimeoutsRef.current.set(reactKey, timeoutId);

    setReplayCards((current) => {
      let next = [...current];
      if (next.length >= MAX_REPLAY_CARDS) {
        const dropped = next.shift();
        if (dropped) {
          const oldTimeout = cardTimeoutsRef.current.get(dropped.reactKey);
          if (oldTimeout != null) {
            clearTimeout(oldTimeout);
          }
          cardTimeoutsRef.current.delete(dropped.reactKey);
        }
      }
      return [...next, { reactKey, entry: latest }];
    });
  }, [replayTimeline, replayTs]);

  useEffect(() => {
    eventScrollRef.current?.scrollToEnd({ animated: true });
  }, [replayCards]);

  const replayPoint = useMemo(
    () => (replayTs == null ? null : getReplayPointAtTimestamp(points, replayTs)),
    [points, replayTs],
  );
  const replayPath = useMemo(
    () => points.filter((point) => replayTs != null && point.timestamp <= replayTs),
    [points, replayTs],
  );
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
      clearReplayCardStack();
      const stepMs = Math.max(1, Math.round(replayDurationMs * 0.05));
      setReplayElapsedMs((current) => {
        const anchor = current ?? 0;
        return clampReplayTs(anchor + direction * stepMs);
      });
    },
    [canReplay, clearReplayCardStack, clampReplayTs, replayDurationMs],
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
      const pressDurationMs =
        pressStartTs == null ? Number.POSITIVE_INFINITY : Date.now() - pressStartTs;
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

  const resetReplayControls = useCallback(() => {
    setIsReplaying(false);
    setHoldDirection(0);
    holdActivatedRef.current = false;
    pressedDirectionRef.current = 0;
    pressStartTsRef.current = null;
    if (holdTimeoutRef.current != null) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    clearReplayCardStack();
    setReplayElapsedMs(0);
  }, [clearReplayCardStack]);

  return {
    replayPauseWindows,
    replayDurationMs,
    replayTs,
    replayElapsedMs,
    setReplayElapsedMs,
    replayPoint,
    replayPath,
    canReplay,
    heading,
    speed,
    journeyDurationMs,
    recordedDistanceMeters,
    isReplaying,
    setIsReplaying,
    setHoldDirection,
    replayCards,
    eventScrollRef,
    mapGestureRef,
    mapNativeGesture,
    handleDirectionalPressIn,
    handleDirectionalPressOut,
    resetReplayControls,
    holdTimeoutRef,
    holdActivatedRef,
    pressedDirectionRef,
  };
}
