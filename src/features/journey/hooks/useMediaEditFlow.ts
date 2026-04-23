import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";

import { openAppDatabase } from "../../../db/client";
import { createMedia, deleteMediaById, updateMediaText } from "../../../db/media";
import type { MediaRow } from "../../../db/schema";
import { unlinkIfExists } from "../../../files/fsCleanup";
import { copyImageToAppDocuments } from "../../../files/imageCopy";

type Params = {
  journeyId: number;
  refreshJourneyData: () => Promise<void>;
};

export type UseMediaEditFlowResult = {
  addModal: {
    visible: boolean;
    text: string;
    busy: boolean;
    error: string | null;
    onChangeText: (text: string) => void;
    onOpen: () => void;
    onClose: () => void;
    onPickImage: () => Promise<void>;
  };
  editModal: {
    target: MediaRow | null;
    text: string;
    busy: boolean;
    openFor: (item: MediaRow) => void;
    close: () => void;
    onChangeText: (text: string) => void;
    save: () => Promise<void>;
    remove: () => Promise<void>;
  };
};

export function useMediaEditFlow({
  journeyId,
  refreshJourneyData,
}: Params): UseMediaEditFlowResult {
  const [addVisible, setAddVisible] = useState(false);
  const [addText, setAddText] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<MediaRow | null>(null);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const onPickImage = useCallback(async (): Promise<void> => {
    if (addBusy) {
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        throw new Error("Media library permission denied.");
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]?.uri) {
        return;
      }
      const copiedFile = await copyImageToAppDocuments(picked.assets[0].uri);
      const db = await openAppDatabase();
      await createMedia(db, {
        journeyId,
        file: copiedFile,
        text: addText.trim() || null,
      });
      setAddText("");
      await refreshJourneyData();
      setAddVisible(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add image.");
    } finally {
      setAddBusy(false);
    }
  }, [addBusy, addText, journeyId, refreshJourneyData]);

  const editSave = useCallback(async (): Promise<void> => {
    if (!editTarget) {
      return;
    }
    const db = await openAppDatabase();
    await updateMediaText(db, editTarget.id, editText.trim() || null);
    await refreshJourneyData();
    setEditTarget(null);
  }, [editTarget, editText, refreshJourneyData]);

  const editRemove = useCallback(async (): Promise<void> => {
    if (!editTarget || editBusy) {
      return;
    }
    setEditBusy(true);
    try {
      await unlinkIfExists(editTarget.file);
      const db = await openAppDatabase();
      await deleteMediaById(db, editTarget.id);
      await refreshJourneyData();
      setEditTarget(null);
    } finally {
      setEditBusy(false);
    }
  }, [editBusy, editTarget, refreshJourneyData]);

  const openEditFor = useCallback((item: MediaRow) => {
    setEditTarget(item);
    setEditText(item.text ?? "");
  }, []);

  return {
    addModal: {
      visible: addVisible,
      text: addText,
      busy: addBusy,
      error: addError,
      onChangeText: setAddText,
      onOpen: () => setAddVisible(true),
      onClose: () => {
        setAddVisible(false);
        setAddText("");
      },
      onPickImage,
    },
    editModal: {
      target: editTarget,
      text: editText,
      busy: editBusy,
      openFor: openEditFor,
      close: () => setEditTarget(null),
      onChangeText: setEditText,
      save: editSave,
      remove: editRemove,
    },
  };
}
