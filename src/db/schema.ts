/** PRD-aligned enums stored as SQLite TEXT + CHECK constraints. */

export type JourneyStatus =
  | "scheduled"
  | "ongoing"
  | "completed"
  | "paused"
  | "abandoned";

export type NoteType = "voice" | "text";

export type MediaType = "image";

export type JourneyRow = {
  id: number;
  name: string;
  description: string | null;
  start_ts: number | null;
  end_ts: number | null;
  status: JourneyStatus;
  metadata: string | null;
  /** Wall-clock span from start to end at completion; null for legacy rows. */
  journey_duration_ms: number | null;
  /** Active time excluding pauses at completion; null for legacy rows. */
  recorded_duration_ms: number | null;
  /** Sum of segment distances between committed points (meters); null for legacy rows. */
  recorded_distance: number | null;
};

export type LocationPointRow = {
  id: number;
  journey_id: number;
  lat: number;
  lng: number;
  timestamp: number;
  metadata: string | null;
  speed: number | null;
  heading: number | null;
};

export type NoteRow = {
  id: number;
  journey_id: number;
  timestamp: number;
  audio_file: string | null;
  /** Whole seconds for voice clips; null for text notes or legacy rows without backfill. */
  audio_duration: number | null;
  audio_transcript: string | null;
  text: string | null;
  type: NoteType;
};

export type MediaRow = {
  id: number;
  journey_id: number;
  timestamp: number | null;
  lat: number | null;
  lng: number | null;
  exif: string | null;
  width: number | null;
  height: number | null;
  text: string | null;
  type: MediaType;
  file: string;
};
