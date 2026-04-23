import { useCallback, useEffect, useRef, useState } from "react";

import { openAppDatabase } from "../../../db/client";
import { updateNoteAudio } from "../../../db/notes";
import type { NoteRow } from "../../../db/schema";
import { unlinkIfExists } from "../../../files/fsCleanup";
import {
  createPreparedVoiceRecorder,
  interruptVoiceRecording,
  stopRecordingAndCopyToAppDocuments,
  type VoiceRecorder,
} from "../../../files/voiceRecording";

type RerecordSession = {
  noteId: number;
  recorder: VoiceRecorder;
};

type Params = {
  refreshJourneyData: () => Promise<void>;
};

export type UseRerecordFlowResult = {
  session: RerecordSession | null;
  busy: boolean;
  error: string | null;
  rerecordNoteAudio: (note: NoteRow) => Promise<void>;
  stopRerecordAndSave: () => Promise<void>;
};

export function useRerecordFlow({ refreshJourneyData }: Params): UseRerecordFlowResult {
  const [session, setSession] = useState<RerecordSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<RerecordSession | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    return () => {
      const s = sessionRef.current;
      if (s?.recorder) {
        setTimeout(() => {
          void interruptVoiceRecording(s.recorder);
        }, 0);
      }
    };
  }, []);

  const rerecordNoteAudio = useCallback(
    async (note: NoteRow): Promise<void> => {
      if (busy || session) {
        return;
      }
      if (note.audio_file) {
        setError("This note already has audio. Delete the note to record again.");
        return;
      }
      setBusy(true);
      setError(null);
      let prepared: VoiceRecorder | null = null;
      try {
        prepared = await createPreparedVoiceRecorder();
        prepared.record();
        setSession({ noteId: note.id, recorder: prepared });
        prepared = null;
      } catch (err) {
        if (prepared !== null) {
          await interruptVoiceRecording(prepared);
        }
        setError(err instanceof Error ? err.message : "Could not start re-recording.");
      } finally {
        setBusy(false);
      }
    },
    [busy, session],
  );

  const stopRerecordAndSave = useCallback(async (): Promise<void> => {
    if (!session || busy) {
      return;
    }
    const { recorder, noteId } = session;
    setSession(null);
    setBusy(true);
    setError(null);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    let copiedFile: string | null = null;
    try {
      const { fileUri, durationSeconds } =
        await stopRecordingAndCopyToAppDocuments(recorder);
      copiedFile = fileUri;
      const db = await openAppDatabase();
      await updateNoteAudio(db, noteId, fileUri, null, durationSeconds);
      await refreshJourneyData();
    } catch (err) {
      if (copiedFile) {
        await unlinkIfExists(copiedFile);
      }
      setError(err instanceof Error ? err.message : "Could not save re-recorded audio.");
    } finally {
      setBusy(false);
    }
  }, [busy, refreshJourneyData, session]);

  return { session, busy, error, rerecordNoteAudio, stopRerecordAndSave };
}
