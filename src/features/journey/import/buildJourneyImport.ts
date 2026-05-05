import type { JourneyExportPayload } from "../export/buildJourneyExport";
import { EXPORT_MAX_BYTES } from "../export/buildJourneyExport";
import type {
  JourneyRow,
  LocationPointRow,
  MediaRow,
  NoteRow,
  NoteType,
  WeatherRow,
} from "../../../db/schema";

/** Same cap as export ([feat_import.md](../../../../feat_import.md) §3). */
export const IMPORT_MAX_BYTES = EXPORT_MAX_BYTES;

export type FileSizeProbe = (uri: string) => Promise<{ exists: boolean; size: number }>;

export type ParseJourneyImportPayloadResult =
  | {
      ok: true;
      payload: JourneyExportPayload;
      skippedPointsInJson: number;
      skippedNotesInJson: number;
      skippedMediaInJson: number;
    }
  | { ok: false; error: string };

const NOTE_TYPES = new Set<NoteType>(["voice", "text"]);
const MEDIA_TYPES = new Set(["image"] as const);

export function isValidNoteType(value: unknown): value is NoteType {
  return typeof value === "string" && NOTE_TYPES.has(value as NoteType);
}

export function isValidMediaType(value: unknown): value is "image" {
  return typeof value === "string" && MEDIA_TYPES.has(value as "image");
}

/**
 * Asset paths in JSON must be basenames only: no separators, no `..`, no scheme.
 */
export function isSafeAssetBasename(name: string | null | undefined): boolean {
  if (name == null || name === "") {
    return false;
  }
  if (name.includes("/") || name.includes("\\")) {
    return false;
  }
  if (name.includes("..")) {
    return false;
  }
  if (name.startsWith("file:") || name.startsWith("content:")) {
    return false;
  }
  return true;
}

export function imageExtensionFromBasename(basename: string): ".jpg" | ".png" {
  const lower = basename.toLowerCase();
  if (lower.endsWith(".png")) {
    return ".png";
  }
  return ".jpg";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asNumber(value: unknown, fallback: number): number {
  const n = asNullableNumber(value);
  return n ?? fallback;
}

function clampStr(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return s.slice(0, max);
}

function coerceJourneyRow(raw: unknown): JourneyRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const rawName = asNullableString(raw.name)?.trim();
  const name = clampStr(rawName && rawName.length > 0 ? rawName : "Imported journey", 100);
  const statusRaw = asNullableString(raw.status);
  const status =
    statusRaw === "scheduled" ||
    statusRaw === "ongoing" ||
    statusRaw === "completed" ||
    statusRaw === "paused" ||
    statusRaw === "abandoned"
      ? statusRaw
      : "completed";

  return {
    id: asNumber(raw.id, 0),
    name,
    description: asNullableString(raw.description),
    start_ts: asNullableNumber(raw.start_ts),
    end_ts: asNullableNumber(raw.end_ts),
    status,
    metadata: asNullableString(raw.metadata),
    journey_duration_ms: asNullableNumber(raw.journey_duration_ms),
    recorded_duration_ms: asNullableNumber(raw.recorded_duration_ms),
    recorded_distance: asNullableNumber(raw.recorded_distance),
  };
}

function coerceLocationPoint(raw: unknown): LocationPointRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const lat = asNullableNumber(raw.lat);
  const lng = asNullableNumber(raw.lng);
  const timestamp = asNullableNumber(raw.timestamp);
  if (lat == null || lng == null || timestamp == null) {
    return null;
  }
  return {
    id: asNumber(raw.id, 0),
    journey_id: asNumber(raw.journey_id, 0),
    lat,
    lng,
    timestamp,
    metadata: asNullableString(raw.metadata),
    speed: asNullableNumber(raw.speed),
    heading: asNullableNumber(raw.heading),
  };
}

function coerceNoteRow(raw: unknown): NoteRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const type = raw.type;
  if (!isValidNoteType(type)) {
    return null;
  }
  return {
    id: asNumber(raw.id, 0),
    journey_id: asNumber(raw.journey_id, 0),
    timestamp: asNumber(raw.timestamp, Date.now()),
    audio_file: asNullableString(raw.audio_file),
    audio_duration: asNullableNumber(raw.audio_duration),
    audio_transcript: asNullableString(raw.audio_transcript),
    text: asNullableString(raw.text),
    type,
  };
}

function coerceMediaRow(raw: unknown): MediaRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const type = raw.type;
  if (!isValidMediaType(type)) {
    return null;
  }
  const file = asNullableString(raw.file);
  if (file == null) {
    return null;
  }
  return {
    id: asNumber(raw.id, 0),
    journey_id: asNumber(raw.journey_id, 0),
    timestamp: asNullableNumber(raw.timestamp),
    lat: asNullableNumber(raw.lat),
    lng: asNullableNumber(raw.lng),
    exif: asNullableString(raw.exif),
    width: asNullableNumber(raw.width),
    height: asNullableNumber(raw.height),
    text: asNullableString(raw.text),
    type: "image",
    file,
  };
}

function coerceWeatherRow(raw: unknown): WeatherRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const timestamp = asNullableNumber(raw.timestamp);
  const lat = asNullableNumber(raw.lat);
  const lng = asNullableNumber(raw.lng);
  if (timestamp == null || lat == null || lng == null) {
    return null;
  }
  const fullData = asNullableString(raw.full_data);
  return {
    id: asNumber(raw.id, 0),
    journey_id: asNumber(raw.journey_id, 0),
    temperature: asNullableNumber(raw.temperature),
    feels_like_temperature: asNullableNumber(raw.feels_like_temperature),
    weather_condition: asNullableString(raw.weather_condition),
    weather_condition_icon: asNullableString(raw.weather_condition_icon),
    full_data: fullData ?? "{}",
    timestamp,
    lat,
    lng,
  };
}

/**
 * Parses `journey.json` string. No rich per-field schema; coerces shapes where possible.
 * Rejects only on JSON parse failure or missing top-level keys.
 */
export function parseJourneyImportPayload(jsonString: string): ParseJourneyImportPayloadResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  if (!isRecord(data)) {
    return { ok: false, error: "Invalid payload root." };
  }
  const keys = ["journey", "points", "notes", "media", "weather"] as const;
  for (const k of keys) {
    if (!(k in data)) {
      return { ok: false, error: `Missing required key: ${k}.` };
    }
  }
  const journey = coerceJourneyRow(data.journey);
  if (journey == null) {
    return { ok: false, error: "Invalid journey object." };
  }
  if (!Array.isArray(data.points)) {
    return { ok: false, error: "points must be an array." };
  }
  if (!Array.isArray(data.notes)) {
    return { ok: false, error: "notes must be an array." };
  }
  if (!Array.isArray(data.media)) {
    return { ok: false, error: "media must be an array." };
  }
  if (!Array.isArray(data.weather)) {
    return { ok: false, error: "weather must be an array." };
  }

  let skippedPointsInJson = 0;
  const points: LocationPointRow[] = [];
  for (const p of data.points) {
    const row = coerceLocationPoint(p);
    if (row) {
      points.push(row);
    } else {
      skippedPointsInJson += 1;
    }
  }

  let skippedNotesInJson = 0;
  const notes: NoteRow[] = [];
  for (const n of data.notes) {
    if (!isRecord(n)) {
      skippedNotesInJson += 1;
      continue;
    }
    if (!isValidNoteType(n.type)) {
      skippedNotesInJson += 1;
      continue;
    }
    const row = coerceNoteRow(n);
    if (row) {
      notes.push(row);
    } else {
      skippedNotesInJson += 1;
    }
  }

  let skippedMediaInJson = 0;
  const media: MediaRow[] = [];
  for (const m of data.media) {
    if (!isRecord(m)) {
      skippedMediaInJson += 1;
      continue;
    }
    if (!isValidMediaType(m.type)) {
      skippedMediaInJson += 1;
      continue;
    }
    const file = asNullableString(m.file);
    if (file == null || !isSafeAssetBasename(file)) {
      skippedMediaInJson += 1;
      continue;
    }
    const row = coerceMediaRow(m);
    if (row) {
      media.push(row);
    } else {
      skippedMediaInJson += 1;
    }
  }

  const weather: WeatherRow[] = [];
  for (const w of data.weather) {
    const row = coerceWeatherRow(w);
    if (row) {
      weather.push(row);
    }
  }

  return {
    ok: true,
    payload: { journey, points, notes, media, weather },
    skippedPointsInJson,
    skippedNotesInJson,
    skippedMediaInJson,
  };
}

/** Ensures a single trailing `/` for joining basenames. */
export function normalizeStagingDir(dir: string): string {
  return dir.endsWith("/") ? dir : `${dir}/`;
}

export type PreparedVoiceNote = {
  timestamp: number;
  type: "voice" | "text";
  text: string | null;
  audioTranscript: string | null;
  audioDurationSeconds: number | null;
  /** If non-null, copy this staging file after DB commit. */
  voiceStagingUri: string | null;
};

export type PreparedMediaRow = {
  timestamp: number | null;
  lat: number | null;
  lng: number | null;
  exif: string | null;
  width: number | null;
  height: number | null;
  text: string | null;
  stagingUri: string;
};

/**
 * Counts notes skipped due to invalid `type` enum (not coercible).
 */
export function countSkippedNotesFromRawPayload(notesUnknown: unknown[]): number {
  let skipped = 0;
  for (const n of notesUnknown) {
    if (!isRecord(n)) {
      skipped += 1;
      continue;
    }
    if (!isValidNoteType(n.type)) {
      skipped += 1;
    }
  }
  return skipped;
}

/**
 * Probes staging files for parsed media rows; skips rows whose asset is missing or empty.
 */
export async function buildMediaImportPlans(
  mediaRows: MediaRow[],
  stagingDir: string,
  probe: FileSizeProbe,
): Promise<{ rows: PreparedMediaRow[]; skippedMissingFile: number }> {
  const dir = normalizeStagingDir(stagingDir);
  let skippedMissingFile = 0;
  const rows: PreparedMediaRow[] = [];

  for (const m of mediaRows) {
    const file = m.file;
    if (!isSafeAssetBasename(file)) {
      skippedMissingFile += 1;
      continue;
    }
    const uri = `${dir}${file}`;
    const info = await probe(uri);
    if (!info.exists || info.size <= 0) {
      skippedMissingFile += 1;
      continue;
    }
    rows.push({
      timestamp: m.timestamp,
      lat: m.lat,
      lng: m.lng,
      exif: m.exif,
      width: m.width,
      height: m.height,
      text: m.text == null ? null : clampStr(m.text, 150),
      stagingUri: uri,
    });
  }
  return { rows, skippedMissingFile };
}

/**
 * Builds note insert plans: skips invalid enum rows (already excluded from payload by parse).
 * For voice, resolves staging path or null when basename unsafe or file missing.
 */
export async function buildPreparedVoiceNotes(args: {
  notes: NoteRow[];
  stagingDir: string;
  probe: FileSizeProbe;
}): Promise<PreparedVoiceNote[]> {
  const dir = normalizeStagingDir(args.stagingDir);
  const out: PreparedVoiceNote[] = [];

  for (const note of args.notes) {
    if (note.type === "text") {
      out.push({
        timestamp: note.timestamp,
        type: "text",
        text: note.text,
        audioTranscript: null,
        audioDurationSeconds: null,
        voiceStagingUri: null,
      });
      continue;
    }
    let voiceStagingUri: string | null = null;
    const audio = note.audio_file;
    if (audio != null && isSafeAssetBasename(audio)) {
      const uri = `${dir}${audio}`;
      const info = await args.probe(uri);
      if (info.exists && info.size > 0) {
        voiceStagingUri = uri;
      }
    }
    out.push({
      timestamp: note.timestamp,
      type: "voice",
      text: note.text,
      audioTranscript: note.audio_transcript,
      audioDurationSeconds: note.audio_duration,
      voiceStagingUri,
    });
  }
  return out;
}

/**
 * After unzip, rejects nested directories (non–flat layout) and entries whose names are unsafe.
 */
export async function assertFlatStagingDirectory(
  stagingDir: string,
  readDirectory: (path: string) => Promise<string[]>,
  getInfo: (path: string) => Promise<{ exists: boolean; isDirectory: boolean }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = normalizeStagingDir(stagingDir);
  let names: string[];
  try {
    names = await readDirectory(dir);
  } catch {
    return { ok: false, error: "Could not read extracted archive." };
  }
  if (!names.includes("journey.json")) {
    return { ok: false, error: "Archive is missing journey.json." };
  }
  for (const name of names) {
    if (!isSafeAssetBasename(name) && name !== "journey.json") {
      return { ok: false, error: "Archive contains an invalid entry name." };
    }
    const fullPath = `${dir}${name}`;
    const info = await getInfo(fullPath);
    if (!info.exists) {
      continue;
    }
    if (info.isDirectory) {
      return { ok: false, error: "Archive must be flat (no subfolders)." };
    }
  }
  return { ok: true };
}
