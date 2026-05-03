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

export type JourneyExportRunResult =
  | { ok: true; hadMissingAssets: boolean; savedToDocuments: boolean }
  | { ok: false; error: string };

async function defaultFileProbe(uri: string): Promise<{ exists: boolean; size: number }> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) {
    return { exists: false, size: 0 };
  }
  return { exists: true, size: info.size };
}

/**
 * Android-only: stages `journey.json` and assets, zips, copies into user-granted Documents (SAF), shares the zip.
 */
export async function runJourneyExportAndroid(
  journeyId: number,
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

  const stamp = Date.now();
  const stagingDir = `${cache}journey_export_${journeyId}_${stamp}/`;
  const zipName = journeyExportZipFilename(bundle.journey);
  const zipPath = `${cache}journey_export_${journeyId}_${stamp}.zip`;

  let savedToDocuments = false;

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

    const { StorageAccessFramework } = FileSystem;
    try {
      const initial = StorageAccessFramework.getUriForDirectoryInRoot("Documents");
      const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync(initial);
      if (perm.granted) {
        const stem = zipFilenameStemForSaf(zipName);
        const safFileUri = await StorageAccessFramework.createFileAsync(
          perm.directoryUri,
          stem,
          "application/zip",
        );
        await FileSystem.copyAsync({ from: zipPath, to: safFileUri });
        savedToDocuments = true;
      }
    } catch {
      // SAF is best-effort; user can still share from cache.
    }

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, error: "Sharing is not available on this device." };
    }
    let shareUri = zipPath;
    try {
      shareUri = await FileSystem.getContentUriAsync(zipPath);
    } catch {
      // keep file://
    }
    await Sharing.shareAsync(shareUri, {
      mimeType: "application/zip",
      UTI: "public.zip-archive",
    });

    return { ok: true, hadMissingAssets: prep.hadMissingAssets, savedToDocuments };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed.";
    return { ok: false, error: message };
  } finally {
    try {
      await FileSystem.deleteAsync(stagingDir, { idempotent: true });
    } catch {
      // ignore
    }
    try {
      await FileSystem.deleteAsync(zipPath, { idempotent: true });
    } catch {
      // ignore
    }
  }
}
