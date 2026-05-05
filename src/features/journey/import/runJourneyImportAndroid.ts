import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";
import { unzip } from "react-native-zip-archive";

import type { MediaRow } from "../../../db/schema";
import { openAppDatabase } from "../../../db/client";
import {
  deleteJourneyWithFileGc,
  hasOngoingJourney,
  insertJourneyForImport,
} from "../../../db/journeys";
import { insertLocationPoint } from "../../../db/locationPoints";
import { createMedia, updateMediaFile } from "../../../db/media";
import { createNote, updateNoteAudio } from "../../../db/notes";
import { createWeather } from "../../../db/weather";
import { randomUuid } from "../../../files/uuid";
import {
  IMPORT_MAX_BYTES,
  assertFlatStagingDirectory,
  buildMediaImportPlans,
  buildPreparedVoiceNotes,
  imageExtensionFromBasename,
  normalizeStagingDir,
  parseJourneyImportPayload,
  type FileSizeProbe,
} from "./buildJourneyImport";

export type JourneyImportRunResult =
  | { ok: true; journeyId: number; skippedRowCount: number; missingAssetCount: number }
  | { ok: false; error: string; cancelled?: boolean };

const JOURNEY_IMPORT_CACHE_DIR = /^journey_import_\d+$/;

const SWEEP_MIN_ARTIFACT_AGE_MS = 120_000;

function clampStr(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return s.slice(0, max);
}

function parseImportStampMs(name: string): number | null {
  const m = JOURNEY_IMPORT_CACHE_DIR.exec(name);
  if (m == null) {
    return null;
  }
  const stamp = Number(name.replace(/^journey_import_/, ""));
  return Number.isFinite(stamp) ? stamp : null;
}

async function sweepStaleJourneyImportArtifacts(cacheDir: string): Promise<void> {
  const now = Date.now();
  try {
    const names = await FileSystem.readDirectoryAsync(cacheDir);
    for (const name of names) {
      if (!JOURNEY_IMPORT_CACHE_DIR.test(name)) {
        continue;
      }
      const stamp = parseImportStampMs(name);
      if (stamp == null || now - stamp < SWEEP_MIN_ARTIFACT_AGE_MS) {
        continue;
      }
      const path = `${cacheDir}${name}`;
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && info.isDirectory) {
        await FileSystem.deleteAsync(path, { idempotent: true });
      }
    }
  } catch {
    // ignore sweep errors
  }
}

async function defaultFileProbe(uri: string): Promise<{ exists: boolean; size: number }> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) {
    return { exists: false, size: 0 };
  }
  return { exists: true, size: info.size };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  }
}

type VoiceCopyTask = {
  newNoteId: number;
  stagingUri: string | null;
  audioTranscript: string | null;
  audioDurationSeconds: number | null;
};

/**
 * Android-only: pick a `.zip`, unzip, parse `journey.json`, insert journey + children in one transaction, then copy assets.
 */
export async function runJourneyImportAndroid(opts?: {
  signal?: AbortSignal;
  probe?: FileSizeProbe;
}): Promise<JourneyImportRunResult> {
  if (Platform.OS !== "android") {
    return { ok: false, error: "Journey import is only available on Android." };
  }

  const signal = opts?.signal;
  const probe = opts?.probe ?? defaultFileProbe;

  let stagingDir: string | null = null;
  let committedJourneyId: number | null = null;

  try {
    throwIfAborted(signal);

    const pick = await DocumentPicker.getDocumentAsync({
      type: ["application/zip", "application/x-zip-compressed"],
      copyToCacheDirectory: true,
    });
    if (pick.canceled || !pick.assets[0]) {
      return { ok: false, error: "Import canceled.", cancelled: true };
    }
    const asset = pick.assets[0];
    if (!asset.name.toLowerCase().endsWith(".zip")) {
      return { ok: false, error: "Please select a file ending in .zip." };
    }

    throwIfAborted(signal);

    const zipInfo = await FileSystem.getInfoAsync(asset.uri);
    if (!zipInfo.exists || zipInfo.isDirectory) {
      return { ok: false, error: "Could not read the selected archive." };
    }
    const zipSize =
      "size" in zipInfo && typeof zipInfo.size === "number" ? zipInfo.size : 0;
    if (zipSize > IMPORT_MAX_BYTES) {
      return {
        ok: false,
        error: `This file exceeds the ${Math.round(IMPORT_MAX_BYTES / (1024 * 1024))} MB import limit.`,
      };
    }

    const db = await openAppDatabase();
    if (await hasOngoingJourney(db)) {
      return {
        ok: false,
        error:
          "Finish, pause, or abandon your ongoing journey before importing another one.",
      };
    }

    throwIfAborted(signal);

    const cache = FileSystem.cacheDirectory;
    if (cache == null || cache === "") {
      return { ok: false, error: "Cache directory is not available." };
    }

    await sweepStaleJourneyImportArtifacts(cache);

    const stamp = Date.now();
    stagingDir = `${cache}journey_import_${stamp}/`;
    await FileSystem.makeDirectoryAsync(stagingDir, { intermediates: true });

    await unzip(asset.uri, stagingDir);

    const flat = await assertFlatStagingDirectory(
      stagingDir,
      (p) => FileSystem.readDirectoryAsync(p),
      async (p) => {
        const info = await FileSystem.getInfoAsync(p);
        return { exists: info.exists, isDirectory: Boolean(info.isDirectory) };
      },
    );
    if (!flat.ok) {
      return { ok: false, error: flat.error };
    }

    throwIfAborted(signal);

    const jsonPath = `${normalizeStagingDir(stagingDir)}journey.json`;
    const jsonString = await FileSystem.readAsStringAsync(jsonPath, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const parsed = parseJourneyImportPayload(jsonString);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }

    const { payload } = parsed;
    const preparedNotes = await buildPreparedVoiceNotes({
      notes: payload.notes,
      stagingDir,
      probe,
    });
    const mediaPlans = await buildMediaImportPlans(
      payload.media as MediaRow[],
      stagingDir,
      probe,
    );

    const skippedRowCount =
      parsed.skippedPointsInJson +
      parsed.skippedNotesInJson +
      parsed.skippedMediaInJson +
      mediaPlans.skippedMissingFile;

    throwIfAborted(signal);

    let newJourneyId = 0;
    const voiceTasks: VoiceCopyTask[] = [];
    const mediaTasks: { newMediaId: number; stagingUri: string }[] = [];

    const journey = payload.journey;

    await db.withTransactionAsync(async () => {
      throwIfAborted(signal);

      newJourneyId = await insertJourneyForImport(db, {
        name: clampStr(journey.name, 100),
        description:
          journey.description == null ? null : clampStr(journey.description, 1000),
        start_ts: journey.start_ts,
        end_ts: journey.end_ts,
        metadata: journey.metadata,
        journey_duration_ms: journey.journey_duration_ms,
        recorded_duration_ms: journey.recorded_duration_ms,
        recorded_distance: journey.recorded_distance,
      });

      for (const pt of payload.points) {
        throwIfAborted(signal);
        await insertLocationPoint(db, {
          journeyId: newJourneyId,
          lat: pt.lat,
          lng: pt.lng,
          timestamp: pt.timestamp,
          metadata: pt.metadata,
          speed: pt.speed,
          heading: pt.heading,
        });
      }

      for (const pn of preparedNotes) {
        throwIfAborted(signal);
        const newNoteId = await createNote(db, {
          journeyId: newJourneyId,
          type: pn.type,
          text: pn.text == null ? null : clampStr(pn.text, 1000),
          audioFile: null,
          audioDurationSeconds: pn.audioDurationSeconds,
          audioTranscript: pn.audioTranscript,
          timestamp: pn.timestamp,
        });
        if (pn.type === "voice") {
          voiceTasks.push({
            newNoteId,
            stagingUri: pn.voiceStagingUri,
            audioTranscript: pn.audioTranscript,
            audioDurationSeconds: pn.audioDurationSeconds,
          });
        }
      }

      for (const row of mediaPlans.rows) {
        throwIfAborted(signal);
        const newMediaId = await createMedia(db, {
          journeyId: newJourneyId,
          file: row.stagingUri,
          text: row.text,
          timestamp: row.timestamp,
          lat: row.lat,
          lng: row.lng,
          exif: row.exif,
          width: row.width,
          height: row.height,
        });
        mediaTasks.push({ newMediaId, stagingUri: row.stagingUri });
      }

      for (const w of payload.weather) {
        throwIfAborted(signal);
        await createWeather(db, {
          journeyId: newJourneyId,
          temperature: w.temperature,
          feelsLikeTemperature: w.feels_like_temperature,
          weatherCondition: w.weather_condition,
          weatherConditionIcon: w.weather_condition_icon,
          fullData: w.full_data,
          timestamp: w.timestamp,
          lat: w.lat,
          lng: w.lng,
        });
      }
    });

    committedJourneyId = newJourneyId;

    const doc = FileSystem.documentDirectory;
    if (doc == null || doc === "") {
      await deleteJourneyWithFileGc(db, newJourneyId);
      committedJourneyId = null;
      return { ok: false, error: "App document directory is not available." };
    }

    let missingAssetCount = 0;

    for (const t of voiceTasks) {
      throwIfAborted(signal);
      if (t.stagingUri == null) {
        continue;
      }
      const dest = `${doc}voice-${t.newNoteId}-${randomUuid()}.m4a`;
      try {
        await FileSystem.copyAsync({ from: t.stagingUri, to: dest });
        await updateNoteAudio(
          db,
          t.newNoteId,
          dest,
          t.audioTranscript,
          t.audioDurationSeconds,
        );
      } catch (e) {
        missingAssetCount += 1;
        Sentry.captureException(e, {
          extra: { phase: "voice-copy", noteId: t.newNoteId },
        });
      }
    }

    for (const t of mediaTasks) {
      throwIfAborted(signal);
      const base = t.stagingUri.split("/").pop() ?? "image.jpg";
      const ext = imageExtensionFromBasename(base);
      const dest = `${doc}image-${t.newMediaId}-${randomUuid()}${ext}`;
      try {
        await FileSystem.copyAsync({ from: t.stagingUri, to: dest });
        await updateMediaFile(db, t.newMediaId, dest);
      } catch (e) {
        missingAssetCount += 1;
        Sentry.captureException(e, {
          extra: { phase: "media-copy", mediaId: t.newMediaId },
        });
      }
    }

    return {
      ok: true,
      journeyId: newJourneyId,
      skippedRowCount,
      missingAssetCount,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      if (committedJourneyId != null) {
        try {
          const dbAbort = await openAppDatabase();
          await deleteJourneyWithFileGc(dbAbort, committedJourneyId);
        } catch {
          // ignore
        }
      }
      return { ok: false, error: "Import canceled.", cancelled: true };
    }
    Sentry.captureException(e, { extra: { phase: "journey-import" } });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Import failed.",
    };
  } finally {
    if (stagingDir != null) {
      try {
        await FileSystem.deleteAsync(stagingDir, { idempotent: true });
      } catch {
        // ignore
      }
    }
  }
}
