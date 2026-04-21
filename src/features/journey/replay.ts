import type { JourneyRow, LocationPointRow, MediaRow, NoteRow } from "../../db/schema";

export type ReplayEvent = {
  kind: "note" | "image";
  timestamp: number;
  text: string;
};

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
  if (!point?.metadata) {
    return null;
  }
  try {
    const parsed = JSON.parse(point.metadata) as { heading?: unknown };
    return typeof parsed.heading === "number" ? parsed.heading : null;
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
