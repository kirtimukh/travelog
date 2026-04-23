import { useCallback, useState } from "react";

import { openAppDatabase } from "../../../db/client";
import { deleteNoteById, updateNoteText } from "../../../db/notes";
import type { NoteRow } from "../../../db/schema";
import { unlinkIfExists } from "../../../files/fsCleanup";

type Params = {
  refreshJourneyData: () => Promise<void>;
};

export type UseNoteEditFlowResult = {
  target: NoteRow | null;
  text: string;
  busy: boolean;
  openFor: (note: NoteRow) => void;
  close: () => void;
  onChangeText: (val: string) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>;
};

export function useNoteEditFlow({ refreshJourneyData }: Params): UseNoteEditFlowResult {
  const [target, setTarget] = useState<NoteRow | null>(null);
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const openFor = useCallback((note: NoteRow) => {
    setTarget(note);
    setText(note.text ?? "");
  }, []);

  const close = useCallback(() => {
    setTarget(null);
  }, []);

  const onChangeText = useCallback((val: string) => {
    setText(val);
  }, []);

  const save = useCallback(async (): Promise<void> => {
    if (!target || target.type !== "text") {
      return;
    }
    const db = await openAppDatabase();
    await updateNoteText(db, target.id, text.trim() || null);
    await refreshJourneyData();
    setTarget(null);
  }, [refreshJourneyData, target, text]);

  const remove = useCallback(async (): Promise<void> => {
    if (!target || busy) {
      return;
    }
    setBusy(true);
    try {
      if (target.audio_file) {
        await unlinkIfExists(target.audio_file);
      }
      const db = await openAppDatabase();
      await deleteNoteById(db, target.id);
      await refreshJourneyData();
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }, [busy, refreshJourneyData, target]);

  return { target, text, busy, openFor, close, onChangeText, save, remove };
}
