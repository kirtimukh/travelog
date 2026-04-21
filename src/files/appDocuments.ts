import * as FileSystem from "expo-file-system/legacy";

import { randomUuid } from "./uuid";

export type AppMediaExtension = ".jpg" | ".m4a";

/**
 * Copies a file into the app document directory with a UUID filename (PRD).
 */
export async function copyIntoAppDocumentsWithUuid(
  sourceUri: string,
  extension: AppMediaExtension,
): Promise<string> {
  const base = FileSystem.documentDirectory;
  if (base == null || base === "") {
    throw new Error("App document directory is not available");
  }
  const ext = extension === ".jpg" ? ".jpg" : ".m4a";
  const dest = `${base}${randomUuid()}${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
