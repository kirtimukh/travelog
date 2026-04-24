import * as FileSystem from "expo-file-system/legacy";

export type PmtilesValidationResult = {
  valid: boolean;
  reason?: string;
};

export async function copyRequiredPmtilesIntoAppDocuments(
  sourceUri: string,
  sourceFileName: string,
): Promise<{ destUri: string; size: number; hash?: string }> {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error("App document directory is not available");
  }
  const dir = `${base}maptiles`;
  const trimmedName = sourceFileName.trim();
  if (!trimmedName.toLowerCase().endsWith(".pmtiles")) {
    throw new Error("Selected file must end with .pmtiles");
  }
  const destUri = `${dir}/${trimmedName}`;

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
  if (!uri.toLowerCase().endsWith(".pmtiles")) {
    return { valid: false, reason: "PMTiles filename must end with .pmtiles" };
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
