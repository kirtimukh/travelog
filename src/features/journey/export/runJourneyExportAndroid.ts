import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { zip } from "react-native-zip-archive";

import { loadJourneyBundle } from "../bundle";
import {
  EXPORT_MAX_BYTES,
  exportExceedsMaxBytes,
  journeyExportZipFilename,
  prepareJourneyExportForZip,
  zipFilenameStemForSaf,
  type FileSizeProbe,
} from "./buildJourneyExport";

export type JourneyExportMode = "download" | "share";

export type JourneyExportRunResult =
  | { ok: true; hadMissingAssets: boolean; outcome: "saved" | "shared" }
  | { ok: false; error: string };

const JOURNEY_EXPORT_CACHE_ARTIFACT = /^journey_export_\d+_(\d+)(\.zip)?$/;

const SHARE_ZIP_DELETE_DELAY_MS = 45_000;

/** Only remove cache artifacts older than this so a zip from a recent share is not deleted mid-upload. */
const SWEEP_MIN_ARTIFACT_AGE_MS = 120_000;

function parseJourneyExportStampMs(name: string): number | null {
  const m = JOURNEY_EXPORT_CACHE_ARTIFACT.exec(name);
  if (m == null) {
    return null;
  }
  const stamp = Number(m[1]);
  return Number.isFinite(stamp) ? stamp : null;
}

async function defaultFileProbe(uri: string): Promise<{ exists: boolean; size: number }> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) {
    return { exists: false, size: 0 };
  }
  return { exists: true, size: info.size };
}

async function sweepStaleJourneyExportArtifacts(cacheDir: string): Promise<void> {
  const now = Date.now();
  try {
    const names = await FileSystem.readDirectoryAsync(cacheDir);
    for (const name of names) {
      const stampMs = parseJourneyExportStampMs(name);
      if (stampMs == null || now - stampMs < SWEEP_MIN_ARTIFACT_AGE_MS) {
        continue;
      }
      try {
        await FileSystem.deleteAsync(`${cacheDir}${name}`, { idempotent: true });
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

function formatSaveError(e: unknown): string {
  if (e instanceof Error && e.message.trim().length > 0) {
    return `Could not save the file: ${e.message}`;
  }
  return "Could not save the file. Try another folder or try again.";
}

/** Bytes per chunk when copying a local zip into a SAF `content://` document (Expo `copyAsync` file→content is broken on Android — it uses `Uri.toFile()` on the destination). */
const SAF_ZIP_COPY_CHUNK_BYTES = 256 * 1024;

async function copyLocalZipToSafDocument(zipPath: string, safFileUri: string, totalBytes: number): Promise<void> {
  for (let offset = 0; offset < totalBytes; offset += SAF_ZIP_COPY_CHUNK_BYTES) {
    const length = Math.min(SAF_ZIP_COPY_CHUNK_BYTES, totalBytes - offset);
    const chunkB64 = await FileSystem.readAsStringAsync(zipPath, {
      encoding: FileSystem.EncodingType.Base64,
      position: offset,
      length,
    });
    await FileSystem.writeAsStringAsync(safFileUri, chunkB64, {
      encoding: FileSystem.EncodingType.Base64,
      append: offset > 0,
    });
  }
}

/**
 * Android-only: builds a zip of `journey.json` and assets in cache, then either
 * copies it via SAF to user-chosen storage (`download`) or opens the share sheet (`share`).
 */
export async function runJourneyExportAndroid(
  journeyId: number,
  mode: JourneyExportMode,
  probe: FileSizeProbe = defaultFileProbe,
): Promise<JourneyExportRunResult> {
  if (Platform.OS !== "android") {
    return { ok: false, error: "Export is only available on Android." };
  }

  const bundle = await loadJourneyBundle(journeyId);
  if (!bundle) {
    return { ok: false, error: "Journey not found." };
  }

  const prep = await prepareJourneyExportForZip(bundle, probe);
  const fileSizes = prep.assets.map((a) => a.sizeBytes);
  if (exportExceedsMaxBytes(prep.jsonUtf8Bytes, fileSizes, EXPORT_MAX_BYTES)) {
    return {
      ok: false,
      error: `This export exceeds the ${Math.round(EXPORT_MAX_BYTES / (1024 * 1024))} MB limit.`,
    };
  }

  const cache = FileSystem.cacheDirectory;
  if (cache == null || cache === "") {
    return { ok: false, error: "Cache directory is not available." };
  }

  await sweepStaleJourneyExportArtifacts(cache);

  const stamp = Date.now();
  const stagingDir = `${cache}journey_export_${journeyId}_${stamp}/`;
  const zipName = journeyExportZipFilename(bundle.journey);
  const zipPath = `${cache}journey_export_${journeyId}_${stamp}.zip`;

  let keepZipForDeferredCleanup = false;

  try {
    await FileSystem.makeDirectoryAsync(stagingDir, { intermediates: true });

    const jsonString = JSON.stringify(prep.payload);
    await FileSystem.writeAsStringAsync(`${stagingDir}journey.json`, jsonString, {
      encoding: "utf8",
    });

    for (const asset of prep.assets) {
      await FileSystem.copyAsync({
        from: asset.sourceUri,
        to: `${stagingDir}${asset.syntheticName}`,
      });
    }

    await zip(stagingDir, zipPath);

    const zipInfo = await FileSystem.getInfoAsync(zipPath);
    if (!zipInfo.exists || zipInfo.isDirectory || zipInfo.size <= 0) {
      return { ok: false, error: "Export archive was empty or could not be created." };
    }
    const zipBytes = zipInfo.size;

    if (mode === "download") {
      const { StorageAccessFramework } = FileSystem;
      const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync(null);
      if (!perm.granted) {
        return {
          ok: false,
          error: "Save was cancelled or folder access was denied.",
        };
      }

      const stem = zipFilenameStemForSaf(zipName);
      let safFileUri: string;
      try {
        safFileUri = await StorageAccessFramework.createFileAsync(
          perm.directoryUri,
          stem,
          "application/zip",
        );
        await copyLocalZipToSafDocument(zipPath, safFileUri, zipBytes);
      } catch (e) {
        return { ok: false, error: formatSaveError(e) };
      }

      const destInfo = await FileSystem.getInfoAsync(safFileUri);
      if (
        !destInfo.exists ||
        destInfo.isDirectory ||
        destInfo.size <= 0 ||
        destInfo.size !== zipBytes
      ) {
        try {
          await FileSystem.deleteAsync(safFileUri, { idempotent: true });
        } catch {
          // ignore
        }
        return {
          ok: false,
          error: "The saved file could not be verified. Try again or pick another folder.",
        };
      }

      return { ok: true, hadMissingAssets: prep.hadMissingAssets, outcome: "saved" };
    }

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, error: "Sharing is not available on this device." };
    }

    await Sharing.shareAsync(zipPath, {
      mimeType: "application/zip",
      UTI: "public.zip-archive",
    });

    keepZipForDeferredCleanup = true;
    setTimeout(() => {
      void FileSystem.deleteAsync(zipPath, { idempotent: true }).catch(() => {
        // ignore
      });
    }, SHARE_ZIP_DELETE_DELAY_MS);

    return { ok: true, hadMissingAssets: prep.hadMissingAssets, outcome: "shared" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed.";
    return { ok: false, error: message };
  } finally {
    try {
      await FileSystem.deleteAsync(stagingDir, { idempotent: true });
    } catch {
      // ignore
    }
    if (!keepZipForDeferredCleanup) {
      try {
        await FileSystem.deleteAsync(zipPath, { idempotent: true });
      } catch {
        // ignore
      }
    }
  }
}
