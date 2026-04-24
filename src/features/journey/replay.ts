import type { JourneyRow, LocationPointRow, MediaRow, NoteRow, WeatherRow } from "../../db/schema";

export type JourneyPauseWindow = {
  startTs: number;
  endTs: number | null;
};

export type ReplayTimelineEntry =
  | { kind: "text_note"; id: number; timestamp: number; preview100: string }
  | { kind: "voice_note"; id: number; timestamp: number; durationSec: number | null }
  | { kind: "image"; id: number; timestamp: number; media: MediaRow }
  | { kind: "weather"; id: number; timestamp: number; condition: string | null; temperature: number | null };

export function replayTimelineEntryKey(entry: ReplayTimelineEntry): string {
  return `${entry.kind}:${entry.id}`;
}

function preview100(value: string | null): string {
  return (value ?? "").slice(0, 100);
}

export function getJourneyPauseWindows(journey: JourneyRow | null): JourneyPauseWindow[] {
  if (!journey?.metadata) {
    return [];
  }
  try {
    const parsed = JSON.parse(journey.metadata) as {
      pauseWindows?: Array<{ startTs?: unknown; endTs?: unknown }>;
    };
    if (!Array.isArray(parsed.pauseWindows)) {
      return [];
    }
    return parsed.pauseWindows
      .filter(
        (entry): entry is { startTs: number; endTs: number | null } =>
          typeof entry.startTs === "number" &&
          (typeof entry.endTs === "number" || entry.endTs === null),
      )
      .map((entry) => ({ startTs: entry.startTs, endTs: entry.endTs }))
      .sort((a, b) => a.startTs - b.startTs);
  } catch {
    return [];
  }
}

export function getReplayTimeBounds(
  journey: JourneyRow | null,
  latestPointTs: number | null,
): { startTs: number; endTs: number } | null {
  if (!journey?.start_ts) {
    return null;
  }
  const startTs = journey.start_ts;
  const endTs = getEffectiveJourneyEndTs(journey, latestPointTs);
  if (endTs <= startTs) {
    return null;
  }
  return { startTs, endTs };
}

function getEffectiveJourneyEndTs(journey: JourneyRow, latestPointTs: number | null): number {
  if (journey.status === "completed") {
    return journey.end_ts ?? latestPointTs ?? journey.start_ts ?? 0;
  }
  return latestPointTs ?? journey.start_ts ?? 0;
}

function getNormalizedPauseWindows(
  journey: JourneyRow,
  latestPointTs: number | null,
): Array<{ startTs: number; endTs: number }> {
  if (!journey.start_ts) {
    return [];
  }
  const journeyStartTs = journey.start_ts;
  const journeyEndTs = getEffectiveJourneyEndTs(journey, latestPointTs);
  if (journeyEndTs <= journeyStartTs) {
    return [];
  }
  return getJourneyPauseWindows(journey)
    .map((window) => ({
      startTs: Math.max(journeyStartTs, window.startTs),
      endTs: Math.min(journeyEndTs, window.endTs ?? journeyEndTs),
    }))
    .filter((window) => window.endTs > window.startTs)
    .sort((a, b) => a.startTs - b.startTs);
}

/** Active (non-paused) duration from journey bounds; shared with completion persistence. */
export function computeRecordedDurationMs(
  journey: JourneyRow | null,
  latestPointTs: number | null,
): number {
  if (!journey?.start_ts) {
    return 0;
  }
  const journeyStartTs = journey.start_ts;
  const journeyEndTs = getEffectiveJourneyEndTs(journey, latestPointTs);
  if (journeyEndTs <= journeyStartTs) {
    return 0;
  }
  const totalPauseMs = getNormalizedPauseWindows(journey, latestPointTs).reduce(
    (sum, window) => sum + (window.endTs - window.startTs),
    0,
  );
  return Math.max(0, journeyEndTs - journeyStartTs - totalPauseMs);
}

export function getReplayRecordedDurationMs(
  journey: JourneyRow | null,
  latestPointTs: number | null,
): number {
  if (journey?.status === "completed" && journey.recorded_duration_ms != null) {
    return journey.recorded_duration_ms;
  }
  return computeRecordedDurationMs(journey, latestPointTs);
}

export function getStoredOrComputedJourneyDurationMs(
  journey: JourneyRow | null,
  latestPointTs: number | null,
): number {
  if (!journey) {
    return 0;
  }
  if (journey.status === "completed" && journey.journey_duration_ms != null) {
    return journey.journey_duration_ms;
  }
  const bounds = getReplayTimeBounds(journey, latestPointTs);
  if (!bounds) {
    return 0;
  }
  return Math.max(0, bounds.endTs - bounds.startTs);
}

export function mapWallTsToRecordedElapsedMs(
  journey: JourneyRow | null,
  wallTs: number,
  latestPointTs: number | null,
): number {
  if (!journey?.start_ts) {
    return 0;
  }
  const journeyStartTs = journey.start_ts;
  const journeyEndTs = getEffectiveJourneyEndTs(journey, latestPointTs);
  if (journeyEndTs <= journeyStartTs) {
    return 0;
  }
  const clampedTs = Math.min(journeyEndTs, Math.max(journeyStartTs, wallTs));
  const windows = getNormalizedPauseWindows(journey, latestPointTs);
  let pauseBefore = 0;
  for (const window of windows) {
    if (clampedTs <= window.startTs) {
      break;
    }
    const overlapEnd = Math.min(clampedTs, window.endTs);
    pauseBefore += Math.max(0, overlapEnd - window.startTs);
  }
  let elapsed = Math.max(0, clampedTs - journeyStartTs - pauseBefore);
  if (journey.status === "completed" && journey.recorded_duration_ms != null) {
    if (clampedTs >= journeyEndTs) {
      return journey.recorded_duration_ms;
    }
    elapsed = Math.min(elapsed, journey.recorded_duration_ms);
  }
  return elapsed;
}

export function mapRecordedElapsedMsToWallTs(
  journey: JourneyRow | null,
  recordedElapsedMs: number,
  latestPointTs: number | null,
): number | null {
  if (!journey?.start_ts) {
    return null;
  }
  const journeyStartTs = journey.start_ts;
  const journeyEndTs = getEffectiveJourneyEndTs(journey, latestPointTs);
  if (journeyEndTs <= journeyStartTs) {
    return null;
  }
  const targetElapsed = Math.max(
    0,
    Math.min(recordedElapsedMs, getReplayRecordedDurationMs(journey, latestPointTs)),
  );
  const windows = getNormalizedPauseWindows(journey, latestPointTs);
  let cursorWallTs = journeyStartTs;
  let remaining = targetElapsed;
  for (const window of windows) {
    if (cursorWallTs >= journeyEndTs) {
      break;
    }
    const activeEnd = Math.min(window.startTs, journeyEndTs);
    const activeSpan = Math.max(0, activeEnd - cursorWallTs);
    if (remaining <= activeSpan) {
      return cursorWallTs + remaining;
    }
    remaining -= activeSpan;
    cursorWallTs = Math.min(journeyEndTs, window.endTs);
  }
  return Math.min(journeyEndTs, cursorWallTs + remaining);
}

export function getReplayPointAtTimestamp(
  points: LocationPointRow[],
  timestamp: number,
): LocationPointRow | null {
  if (points.length === 0) {
    return null;
  }
  let best = points[0];
  for (const point of points) {
    if (point.timestamp > timestamp) {
      break;
    }
    best = point;
  }
  return best;
}

export function getReplayHeading(point: LocationPointRow | null): number | null {
  if (typeof point?.heading === "number") {
    return point.heading;
  }
  if (!point?.metadata) {
    return null;
  }
  try {
    const parsed = JSON.parse(point.metadata) as {
      heading?: unknown;
      coords?: { heading?: unknown };
    };
    if (typeof parsed.heading === "number") {
      return parsed.heading;
    }
    return typeof parsed.coords?.heading === "number" ? parsed.coords.heading : null;
  } catch {
    return null;
  }
}

export function buildReplayTimeline(
  notes: NoteRow[],
  media: MediaRow[],
  weather: WeatherRow[],
): ReplayTimelineEntry[] {
  const noteEntries: ReplayTimelineEntry[] = notes.map((note) =>
    note.type === "voice"
      ? {
          kind: "voice_note" as const,
          id: note.id,
          timestamp: note.timestamp,
          durationSec: note.audio_duration,
        }
      : {
          kind: "text_note" as const,
          id: note.id,
          timestamp: note.timestamp,
          preview100: preview100(note.text),
        },
  );
  const mediaEntries: ReplayTimelineEntry[] = media
    .filter((item) => typeof item.timestamp === "number")
    .map((item) => ({
      kind: "image" as const,
      id: item.id,
      timestamp: item.timestamp as number,
      media: item,
    }));
  const weatherEntries: ReplayTimelineEntry[] = weather.map((row) => ({
    kind: "weather" as const,
    id: row.id,
    timestamp: row.timestamp,
    condition: row.weather_condition,
    temperature: row.temperature,
  }));

  return [...noteEntries, ...mediaEntries, ...weatherEntries].sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return a.id - b.id;
  });
}

export function getLatestReplayTimelineEntry(
  entries: ReplayTimelineEntry[],
  replayTs: number,
): ReplayTimelineEntry | null {
  let latest: ReplayTimelineEntry | null = null;
  for (const event of entries) {
    if (event.timestamp <= replayTs) {
      latest = event;
    } else {
      break;
    }
  }
  return latest;
}
