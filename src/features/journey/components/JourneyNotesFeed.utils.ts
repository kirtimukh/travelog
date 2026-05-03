import type { LocationPointRow, MediaRow, NoteRow, WeatherRow } from "../../../db/schema";
import { formatLatLngPair, formatListTimestamp } from "../displayFormatters";
import type { JourneyPauseWindow } from "../replay";
export const MEDIA_FEED_THUMBNAIL_HEIGHT = 100;

export type FeedItem =
  | { kind: "note"; data: NoteRow; sortTs: number }
  | { kind: "media"; data: MediaRow; sortTs: number }
  | { kind: "weather"; data: WeatherRow; sortTs: number }
  | { kind: "pause"; data: JourneyPauseWindow; sortTs: number };

export function buildFeed(
  notes: NoteRow[],
  media: MediaRow[],
  weather: WeatherRow[],
  pauseWindows: JourneyPauseWindow[],
): FeedItem[] {
  const items: FeedItem[] = [
    ...notes.map((n) => ({
      kind: "note" as const,
      data: n,
      sortTs: n.timestamp,
    })),
    ...media.map((m) => ({
      kind: "media" as const,
      data: m,
      sortTs: m.timestamp ?? Number.MAX_SAFE_INTEGER,
    })),
    ...weather.map((w) => ({
      kind: "weather" as const,
      data: w,
      sortTs: w.timestamp,
    })),
    ...pauseWindows.map((window) => ({
      kind: "pause" as const,
      data: window,
      sortTs: window.startTs,
    })),
  ];
  items.sort((a, b) => a.sortTs - b.sortTs);
  return items;
}

export function notePreviewText(note: NoteRow): string {
  const text = note.text?.trim();
  if (text) {
    return text;
  }
  const transcript = note.audio_transcript?.trim();
  if (transcript) {
    return transcript;
  }
  if (note.type === "voice") {
    return "Voice note";
  }
  return "";
}

function nearestPointByTimestamp(
  points: LocationPointRow[],
  targetTs: number,
): LocationPointRow | null {
  if (points.length === 0) {
    return null;
  }
  let best = points[0]!;
  let bestAbs = Math.abs(best.timestamp - targetTs);
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const abs = Math.abs(p.timestamp - targetTs);
    if (abs < bestAbs) {
      bestAbs = abs;
      best = p;
    }
  }
  return best;
}

export function latLngLabelForNote(note: NoteRow, locationPoints: LocationPointRow[]): string {
  const p = nearestPointByTimestamp(locationPoints, note.timestamp);
  if (!p) {
    return "—";
  }
  return formatLatLngPair(p.lat, p.lng);
}

function latLngLabelForMedia(media: MediaRow, locationPoints: LocationPointRow[]): string {
  if (media.lat != null && media.lng != null) {
    return formatLatLngPair(media.lat, media.lng);
  }
  if (media.timestamp == null || locationPoints.length === 0) {
    return "—";
  }
  const p = nearestPointByTimestamp(locationPoints, media.timestamp);
  if (!p) {
    return "—";
  }
  return formatLatLngPair(p.lat, p.lng);
}

/** Hide placeholder copy when an inline player is shown for the same row. */
export function shouldShowNoteBodyBelowPlayer(note: NoteRow, preview: string): boolean {
  if (!preview) {
    return false;
  }
  if (note.type === "voice" && note.audio_file && preview === "Voice note") {
    return false;
  }
  return true;
}

export function mediaListMetaLine(media: MediaRow, locationPoints: LocationPointRow[]): string {
  const timePart =
    media.timestamp != null ? formatListTimestamp(media.timestamp) : "—";
  return `${timePart} · (${latLngLabelForMedia(media, locationPoints)})`;
}

export function mediaThumbWidth(media: MediaRow): number {
  if (media.width != null && media.height != null && media.width > 0 && media.height > 0) {
    return MEDIA_FEED_THUMBNAIL_HEIGHT * (media.width / media.height);
  }
  return MEDIA_FEED_THUMBNAIL_HEIGHT;
}
