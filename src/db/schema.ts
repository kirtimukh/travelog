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
};

export type LocationPointRow = {
  id: number;
  journey_id: number;
  lat: number;
  lng: number;
  timestamp: number;
  metadata: string | null;
  speed: number | null;
};

export type NoteRow = {
  id: number;
  journey_id: number;
  timestamp: number;
  audio_file: string | null;
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
  text: string | null;
  type: MediaType;
  file: string;
};
