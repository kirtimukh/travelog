import * as FileSystem from "expo-file-system/legacy";

import { REQUIRED_PMTILES_FILENAME } from "../storage/pmtilesConfig";

export type PmtilesValidationResult = {
  valid: boolean;
  reason?: string;
};

export async function copyRequiredPmtilesIntoAppDocuments(
  sourceUri: string,
): Promise<{ destUri: string; size: number; hash?: string }> {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error("App document directory is not available");
  }
  const dir = `${base}maptiles`;
  const destUri = `${dir}/${REQUIRED_PMTILES_FILENAME}`;

  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  const info = await FileSystem.getInfoAsync(destUri, { md5: true });
  if (!info.exists || typeof info.size !== "number" || info.size <= 0) {
    throw new Error("Copied PMTiles file is empty or unreadable");
  }

  return {
    destUri,
    size: info.size,
    hash: typeof info.md5 === "string" ? info.md5 : undefined,
  };
}

export async function validateRequiredPmtiles(
  uri: string | null | undefined,
): Promise<PmtilesValidationResult> {
  if (!uri) {
    return { valid: false, reason: "Missing PMTiles path" };
  }
  if (!uri.toLowerCase().endsWith(`/${REQUIRED_PMTILES_FILENAME}`)) {
    return { valid: false, reason: "PMTiles filename is not india-ne.pmtiles" };
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    return { valid: false, reason: "PMTiles file does not exist" };
  }
  if (typeof info.size !== "number" || info.size <= 0) {
    return { valid: false, reason: "PMTiles file is empty" };
  }
  return { valid: true };
}
