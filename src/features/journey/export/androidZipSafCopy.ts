import * as FileSystem from "expo-file-system/legacy";

/** Bytes per chunk when copying a local zip into a SAF `content://` document (Expo `copyAsync` file→content is broken on Android — it uses `Uri.toFile()` on the destination). */
const SAF_ZIP_COPY_CHUNK_BYTES = 256 * 1024;

export function formatSaveError(e: unknown): string {
  if (e instanceof Error && e.message.trim().length > 0) {
    return `Could not save the file: ${e.message}`;
  }
  return "Could not save the file. Try another folder or try again.";
}

export async function copyLocalZipToSafDocument(
  zipPath: string,
  safFileUri: string,
  totalBytes: number,
): Promise<void> {
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
