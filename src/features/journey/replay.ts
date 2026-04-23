import type { JourneyRow, LocationPointRow, MediaRow, NoteRow } from "../../db/schema";

export type JourneyPauseWindow = {
  startTs: number;
  endTs: number | null;
};

export type ReplayEvent = {
  kind: "note" | "image";
  timestamp: number;
  text: string;
};

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
  nowTs: number,
): { startTs: number; endTs: number } | null {
  if (!journey?.start_ts) {
    return null;
  }
  const startTs = journey.start_ts;
  const endTs =
    journey.status === "completed"
      ? (journey.end_ts ?? nowTs)
      : nowTs;
  if (endTs <= startTs) {
    return null;
  }
  return { startTs, endTs };
}

function getEffectiveJourneyEndTs(journey: JourneyRow, nowTs: number): number {
  return journey.status === "completed" ? (journey.end_ts ?? nowTs) : nowTs;
}

function getNormalizedPauseWindows(
  journey: JourneyRow,
  nowTs: number,
): Array<{ startTs: number; endTs: number }> {
  if (!journey.start_ts) {
    return [];
  }
  const journeyStartTs = journey.start_ts;
  const journeyEndTs = getEffectiveJourneyEndTs(journey, nowTs);
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

export function getReplayRecordedDurationMs(journey: JourneyRow | null, nowTs: number): number {
  if (!journey?.start_ts) {
    return 0;
  }
  const journeyStartTs = journey.start_ts;
  const journeyEndTs = getEffectiveJourneyEndTs(journey, nowTs);
  if (journeyEndTs <= journeyStartTs) {
    return 0;
  }
  const totalPauseMs = getNormalizedPauseWindows(journey, nowTs).reduce(
    (sum, window) => sum + (window.endTs - window.startTs),
    0,
  );
  return Math.max(0, journeyEndTs - journeyStartTs - totalPauseMs);
}

export function mapWallTsToRecordedElapsedMs(
  journey: JourneyRow | null,
  wallTs: number,
  nowTs: number,
): number {
  if (!journey?.start_ts) {
    return 0;
  }
  const journeyStartTs = journey.start_ts;
  const journeyEndTs = getEffectiveJourneyEndTs(journey, nowTs);
  if (journeyEndTs <= journeyStartTs) {
    return 0;
  }
  const clampedTs = Math.min(journeyEndTs, Math.max(journeyStartTs, wallTs));
  const windows = getNormalizedPauseWindows(journey, nowTs);
  let pauseBefore = 0;
  for (const window of windows) {
    if (clampedTs <= window.startTs) {
      break;
    }
    const overlapEnd = Math.min(clampedTs, window.endTs);
    pauseBefore += Math.max(0, overlapEnd - window.startTs);
  }
  return Math.max(0, clampedTs - journeyStartTs - pauseBefore);
}

export function mapRecordedElapsedMsToWallTs(
  journey: JourneyRow | null,
  recordedElapsedMs: number,
  nowTs: number,
): number | null {
  if (!journey?.start_ts) {
    return null;
  }
  const journeyStartTs = journey.start_ts;
  const journeyEndTs = getEffectiveJourneyEndTs(journey, nowTs);
  if (journeyEndTs <= journeyStartTs) {
    return null;
  }
  const targetElapsed = Math.max(
    0,
    Math.min(recordedElapsedMs, getReplayRecordedDurationMs(journey, nowTs)),
  );
  const windows = getNormalizedPauseWindows(journey, nowTs);
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

function previewText(value: string | null): string {
  return (value ?? "").slice(0, 16);
}

export function buildReplayEvents(notes: NoteRow[], media: MediaRow[]): ReplayEvent[] {
  const noteEvents: ReplayEvent[] = notes.map((note) => ({
    kind: "note",
    timestamp: note.timestamp,
    text: `note: ${previewText(note.text)}`,
  }));
  const mediaEvents: ReplayEvent[] = media
    .filter((item) => typeof item.timestamp === "number")
    .map((item) => ({
      kind: "image",
      timestamp: item.timestamp as number,
      text: `image: ${previewText(item.text)}`,
    }));

  return [...noteEvents, ...mediaEvents].sort((a, b) => a.timestamp - b.timestamp);
}

export function getLatestReplayEvent(
  events: ReplayEvent[],
  replayTs: number,
): ReplayEvent | null {
  let latest: ReplayEvent | null = null;
  for (const event of events) {
    if (event.timestamp <= replayTs) {
      latest = event;
    } else {
      break;
    }
  }
  return latest;
}
