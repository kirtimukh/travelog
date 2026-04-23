import { useEffect, useRef, useState } from "react";

import { openAppDatabase } from "../../../db/client";
import { createNote } from "../../../db/notes";
import type { NoteType } from "../../../db/schema";
import { unlinkIfExists } from "../../../files/fsCleanup";
import {
  createPreparedVoiceRecorder,
  interruptVoiceRecording,
  stopRecordingAndCopyToAppDocuments,
  type VoiceRecorder,
} from "../../../files/voiceRecording";
import { JourneyAddNoteModal } from "./JourneyAddNoteModal";

type VoiceNoteDraft = {
  uri: string;
  durationSeconds: number;
};

type Props = {
  journeyId: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

/**
 * Stateful controller that owns the add-note voice recording lifecycle.
 * Conditionally mounted by the screen so that every recording session
 * starts from a clean state — the key fix for flat-tone on 2nd recording.
 */
export function JourneyAddNoteController({ journeyId, onClose, onSaved }: Props) {
  const [newNoteMode, setNewNoteMode] = useState<NoteType>("text");
  const [newNoteText, setNewNoteText] = useState<string>("");
  const [newAudioRecorder, setNewAudioRecorder] = useState<VoiceRecorder | null>(null);
  const newAudioRecorderRef = useRef<VoiceRecorder | null>(null);
  newAudioRecorderRef.current = newAudioRecorder;
  const [newAudioDraft, setNewAudioDraft] = useState<VoiceNoteDraft | null>(null);
  const newAudioDraftRef = useRef<VoiceNoteDraft | null>(null);
  newAudioDraftRef.current = newAudioDraft;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      const rec = newAudioRecorderRef.current;
      const draft = newAudioDraftRef.current;
      if (rec) {
        setTimeout(() => {
          void interruptVoiceRecording(rec);
        }, 0);
      }
      if (draft) {
        setTimeout(() => {
          void unlinkIfExists(draft.uri);
        }, 0);
      }
    };
  }, []);

  function switchAddNoteMode(next: NoteType): void {
    if (next === "text") {
      setNewAudioDraft((prev) => {
        if (prev) {
          void unlinkIfExists(prev.uri);
        }
        return null;
      });
      setNewAudioRecorder((rec) => {
        if (rec) {
          setTimeout(() => {
            void interruptVoiceRecording(rec);
          }, 0);
        }
        return null;
      });
    } else {
      setNewNoteText("");
    }
    setNewNoteMode(next);
  }

  async function addTextNote(): Promise<void> {
    if (!newNoteText.trim() || busy || newAudioRecorder || newAudioDraft) {
      return;
    }
    setBusy(true);
    try {
      const db = await openAppDatabase();
      await createNote(db, {
        journeyId,
        type: "text",
        text: newNoteText.trim(),
      });
      setNewNoteText("");
      await onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function startNewVoiceNoteRecording(): Promise<void> {
    if (newAudioDraft || newAudioRecorder || busy) {
      return;
    }
    setBusy(true);
    let prepared: VoiceRecorder | null = null;
    try {
      prepared = await createPreparedVoiceRecorder();
      await prepared.record();
      setNewAudioRecorder(prepared);
      prepared = null;
    } catch {
      if (prepared !== null) {
        await interruptVoiceRecording(prepared);
      }
    } finally {
      setBusy(false);
    }
  }

  async function stopNewVoiceNoteRecordingAndSave(): Promise<void> {
    if (!newAudioRecorder || busy) {
      return;
    }
    const rec = newAudioRecorder;
    setBusy(true);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    try {
      const result = await stopRecordingAndCopyToAppDocuments(rec);
      setNewAudioDraft({
        uri: result.fileUri,
        durationSeconds: result.durationSeconds,
      });
    } finally {
      setNewAudioRecorder(null);
      setBusy(false);
    }
  }

  async function saveNewVoiceNote(): Promise<void> {
    if (!newAudioDraft || busy) {
      return;
    }
    setBusy(true);
    const draft = newAudioDraft;
    try {
      const db = await openAppDatabase();
      await createNote(db, {
        journeyId,
        type: "voice",
        text: null,
        audioFile: draft.uri,
        audioDurationSeconds: draft.durationSeconds,
      });
      setNewAudioDraft(null);
      await onSaved();
      onClose();
    } catch {
      await unlinkIfExists(draft.uri);
    } finally {
      setBusy(false);
    }
  }

  async function discardPendingVoiceRecording(): Promise<void> {
    if (!newAudioDraft || busy) {
      return;
    }
    setBusy(true);
    try {
      await unlinkIfExists(newAudioDraft.uri);
      setNewAudioDraft(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <JourneyAddNoteModal
      visible
      newNoteMode={newNoteMode}
      newNoteText={newNoteText}
      newAudioRecorder={newAudioRecorder}
      newAudioDraft={newAudioDraft}
      busy={busy}
      onClose={onClose}
      onSwitchAddNoteMode={switchAddNoteMode}
      onChangeNewNoteText={setNewNoteText}
      onAddTextNote={() => {
        void addTextNote();
      }}
      onStartVoiceRecording={() => {
        void startNewVoiceNoteRecording();
      }}
      onStopVoiceRecording={() => {
        void stopNewVoiceNoteRecordingAndSave();
      }}
      onSaveVoiceNote={() => {
        void saveNewVoiceNote();
      }}
      onDiscardVoiceRecording={() => {
        void discardPendingVoiceRecording();
      }}
    />
  );
}
