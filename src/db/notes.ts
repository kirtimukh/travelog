import type * as SQLite from "expo-sqlite";

import type { NoteRow, NoteType } from "./schema";

export async function createNote(
  db: SQLite.SQLiteDatabase,
  input: {
    journeyId: number;
    type: NoteType;
    text?: string | null;
    audioFile?: string | null;
    audioTranscript?: string | null;
    timestamp?: number;
  },
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO note (journey_id, timestamp, audio_file, audio_transcript, text, type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.journeyId,
      input.timestamp ?? Date.now(),
      input.audioFile ?? null,
      input.audioTranscript ?? null,
      input.text ?? null,
      input.type,
    ],
  );
  return Number(result.lastInsertRowId);
}

export async function listNotesForJourney(
  db: SQLite.SQLiteDatabase,
  journeyId: number,
): Promise<NoteRow[]> {
  const rows = await db.getAllAsync<NoteRow>(
    `SELECT id, journey_id, timestamp, audio_file, audio_transcript, text, type
     FROM note
     WHERE journey_id = ?
     ORDER BY timestamp DESC, id DESC`,
    [journeyId],
  );
  return rows;
}

export async function updateNoteText(
  db: SQLite.SQLiteDatabase,
  noteId: number,
  text: string | null,
): Promise<void> {
  await db.runAsync(`UPDATE note SET text = ? WHERE id = ? AND type = 'text'`, [
    text,
    noteId,
  ]);
}

export async function updateNoteAudio(
  db: SQLite.SQLiteDatabase,
  noteId: number,
  audioFile: string | null,
  audioTranscript: string | null,
): Promise<void> {
  await db.runAsync(
    `UPDATE note SET audio_file = ?, audio_transcript = ? WHERE id = ?`,
    [audioFile, audioTranscript, noteId],
  );
}

export async function deleteNoteById(
  db: SQLite.SQLiteDatabase,
  noteId: number,
): Promise<void> {
  await db.runAsync(`DELETE FROM note WHERE id = ?`, [noteId]);
}
