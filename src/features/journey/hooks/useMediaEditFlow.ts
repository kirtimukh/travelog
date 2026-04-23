import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";

import { getCachedCurrentLocation, mergeWithCachedGps } from "../../../location/currentLocationCache";
import { openAppDatabase } from "../../../db/client";
import { createMedia, deleteMediaById, updateMediaDetails } from "../../../db/media";
import type { MediaRow } from "../../../db/schema";
import { unlinkIfExists } from "../../../files/fsCleanup";
import { copyImageToAppDocuments } from "../../../files/imageCopy";

type Params = {
  journeyId: number;
  refreshJourneyData: () => Promise<void>;
  /** Defaults to local clock fields via formatLocalDateTime (live journey screen). */
  formatEditLocalDateTime?: (ts: number | null) => string;
};

export type UseMediaEditFlowResult = {
  addModal: {
    visible: boolean;
    text: string;
    selectedFile: string | null;
    selectedWidth: number | null;
    selectedHeight: number | null;
    busy: boolean;
    error: string | null;
    onChangeText: (text: string) => void;
    onOpen: () => void;
    onClose: () => void;
    onPickImage: () => Promise<void>;
    onSave: () => Promise<void>;
  };
  editModal: {
    target: MediaRow | null;
    text: string;
    timestampEpochMs: string;
    localDateTime: string;
    lat: string;
    lng: string;
    busy: boolean;
    openFor: (item: MediaRow) => void;
    close: () => void;
    onChangeText: (text: string) => void;
    onChangeTimestampEpochMs: (value: string) => void;
    onChangeLocalDateTime: (value: string) => void;
    onChangeLat: (value: string) => void;
    onChangeLng: (value: string) => void;
    save: () => Promise<void>;
    remove: () => Promise<void>;
  };
};

type ExifSource = Record<string, unknown>;

function parseExifDateValue(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.includes(":") && trimmed.includes(" ")
    ? trimmed.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").replace(" ", "T")
    : trimmed;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function pickExifNumber(exif: ExifSource, keys: string[]): number | null {
  for (const key of keys) {
    const value = exif[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function pickExifTimestamp(exif: ExifSource): number | null {
  const keys = [
    "DateTimeOriginal",
    "DateTimeDigitized",
    "DateTime",
    "dateTime",
    "CreationDate",
    "DateCreated",
  ];
  for (const key of keys) {
    const parsed = parseExifDateValue(exif[key]);
    if (parsed != null) {
      return parsed;
    }
  }
  return null;
}

function formatLocalDateTime(ts: number | null): string {
  if (ts == null) {
    return "";
  }
  const date = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseLocalDateTime(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Date.parse(trimmed.replace(" ", "T"));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function useMediaEditFlow({
  journeyId,
  refreshJourneyData,
  formatEditLocalDateTime = formatLocalDateTime,
}: Params): UseMediaEditFlowResult {
  const [addVisible, setAddVisible] = useState(false);
  const [addText, setAddText] = useState("");
  const [addSelectedFile, setAddSelectedFile] = useState<string | null>(null);
  const [addSelectedWidth, setAddSelectedWidth] = useState<number | null>(null);
  const [addSelectedHeight, setAddSelectedHeight] = useState<number | null>(null);
  const [addSelectedExif, setAddSelectedExif] = useState<string | null>(null);
  const [addSelectedTs, setAddSelectedTs] = useState<number | null>(null);
  const [addSelectedLat, setAddSelectedLat] = useState<number | null>(null);
  const [addSelectedLng, setAddSelectedLng] = useState<number | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<MediaRow | null>(null);
  const [editText, setEditText] = useState("");
  const [editTimestampEpochMs, setEditTimestampEpochMs] = useState("");
  const [editLocalDateTime, setEditLocalDateTime] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
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
        exif: true,
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]?.uri) {
        return;
      }
      const asset = picked.assets[0];
      const copiedFile = await copyImageToAppDocuments(asset.uri);
      const exifSource = (asset.exif ?? {}) as ExifSource;
      const exifJson =
        asset.exif && typeof asset.exif === "object" ? JSON.stringify(asset.exif) : null;
      const exifTs = pickExifTimestamp(exifSource);
      const assetCreationTime = (asset as { creationTime?: unknown }).creationTime;
      const creationTs =
        typeof assetCreationTime === "number" && Number.isFinite(assetCreationTime)
          ? assetCreationTime
          : null;
      setAddSelectedFile(copiedFile);
      setAddSelectedWidth(
        typeof asset.width === "number" && Number.isFinite(asset.width) ? asset.width : null,
      );
      setAddSelectedHeight(
        typeof asset.height === "number" && Number.isFinite(asset.height) ? asset.height : null,
      );
      setAddSelectedExif(exifJson);
      setAddSelectedTs(exifTs ?? creationTs ?? Date.now());
      const exifLat = pickExifNumber(exifSource, ["GPSLatitude", "latitude", "lat"]);
      const exifLng = pickExifNumber(exifSource, ["GPSLongitude", "longitude", "lng", "lon"]);
      const merged = mergeWithCachedGps({
        exifLat,
        exifLng,
        cache: getCachedCurrentLocation(),
      });
      setAddSelectedLat(merged.lat);
      setAddSelectedLng(merged.lng);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add image.");
    } finally {
      setAddBusy(false);
    }
  }, [addBusy, addText, journeyId, refreshJourneyData]);

  const addSave = useCallback(async (): Promise<void> => {
    if (!addSelectedFile || addBusy) {
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      const db = await openAppDatabase();
      await createMedia(db, {
        journeyId,
        file: addSelectedFile,
        text: addText.trim() || null,
        exif: addSelectedExif,
        timestamp: addSelectedTs,
        lat: addSelectedLat,
        lng: addSelectedLng,
        width: addSelectedWidth,
        height: addSelectedHeight,
      });
      setAddText("");
      setAddSelectedFile(null);
      setAddSelectedWidth(null);
      setAddSelectedHeight(null);
      setAddSelectedExif(null);
      setAddSelectedTs(null);
      setAddSelectedLat(null);
      setAddSelectedLng(null);
      await refreshJourneyData();
      setAddVisible(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add image.");
    } finally {
      setAddBusy(false);
    }
  }, [
    addBusy,
    addSelectedExif,
    addSelectedFile,
    addSelectedHeight,
    addSelectedLat,
    addSelectedLng,
    addSelectedTs,
    addSelectedWidth,
    addText,
    journeyId,
    refreshJourneyData,
  ]);

  const editSave = useCallback(async (): Promise<void> => {
    if (!editTarget || editBusy) {
      return;
    }
    const parsedEpoch = Number(editTimestampEpochMs.trim());
    const epochValue =
      editTimestampEpochMs.trim().length > 0 && Number.isFinite(parsedEpoch) ? parsedEpoch : null;
    const localValue = parseLocalDateTime(editLocalDateTime);
    const resolvedTs = localValue ?? epochValue ?? null;

    const parseFloatInput = (value: string, existing: number | null): number | null => {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
      return existing;
    };

    const db = await openAppDatabase();
    await updateMediaDetails(db, editTarget.id, {
      text: editText.trim() || null,
      timestamp: resolvedTs,
      lat: parseFloatInput(editLat, editTarget.lat),
      lng: parseFloatInput(editLng, editTarget.lng),
    });
    await refreshJourneyData();
    setEditTarget(null);
  }, [
    editBusy,
    editLat,
    editLng,
    editLocalDateTime,
    editTarget,
    editText,
    editTimestampEpochMs,
    refreshJourneyData,
  ]);

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

  const openEditFor = useCallback(
    (item: MediaRow) => {
      setEditTarget(item);
      setEditText(item.text ?? "");
      setEditTimestampEpochMs(item.timestamp != null ? String(item.timestamp) : "");
      setEditLocalDateTime(formatEditLocalDateTime(item.timestamp));
      setEditLat(item.lat != null ? String(item.lat) : "");
      setEditLng(item.lng != null ? String(item.lng) : "");
    },
    [formatEditLocalDateTime],
  );

  return {
    addModal: {
      visible: addVisible,
      text: addText,
      selectedFile: addSelectedFile,
      selectedWidth: addSelectedWidth,
      selectedHeight: addSelectedHeight,
      busy: addBusy,
      error: addError,
      onChangeText: setAddText,
      onOpen: () => setAddVisible(true),
      onClose: () => {
        setAddVisible(false);
        setAddText("");
        setAddSelectedFile(null);
        setAddSelectedWidth(null);
        setAddSelectedHeight(null);
        setAddSelectedExif(null);
        setAddSelectedTs(null);
        setAddSelectedLat(null);
        setAddSelectedLng(null);
      },
      onPickImage,
      onSave: addSave,
    },
    editModal: {
      target: editTarget,
      text: editText,
      timestampEpochMs: editTimestampEpochMs,
      localDateTime: editLocalDateTime,
      lat: editLat,
      lng: editLng,
      busy: editBusy,
      openFor: openEditFor,
      close: () => setEditTarget(null),
      onChangeText: setEditText,
      onChangeTimestampEpochMs: setEditTimestampEpochMs,
      onChangeLocalDateTime: setEditLocalDateTime,
      onChangeLat: setEditLat,
      onChangeLng: setEditLng,
      save: editSave,
      remove: editRemove,
    },
  };
}
