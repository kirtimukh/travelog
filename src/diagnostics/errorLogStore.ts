import * as FileSystem from "expo-file-system/legacy";

import type { ErrorLogEntry } from "./errorLogTypes";
import { parseJsonlLines } from "./parseJsonlLines";

export const ERROR_LOG_FILENAME = "app-errors.jsonl";

function logFileUri(): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) {
    return null;
  }
  return `${base}${ERROR_LOG_FILENAME}`;
}

let appendChain: Promise<void> = Promise.resolve();

function runExclusive(task: () => Promise<void>): Promise<void> {
  const next = appendChain.then(task, task);
  appendChain = next.catch(() => {});
  return next;
}

export async function appendErrorLogEntry(entry: ErrorLogEntry): Promise<void> {
  const uri = logFileUri();
  if (!uri) {
    return;
  }
  const line = `${JSON.stringify(entry)}\n`;
  await runExclusive(async () => {
    const info = await FileSystem.getInfoAsync(uri);
    const prev = info.exists && !info.isDirectory ? await FileSystem.readAsStringAsync(uri) : "";
    await FileSystem.writeAsStringAsync(uri, prev + line);
  });
}

export async function readErrorLogEntries(): Promise<ErrorLogEntry[]> {
  const uri = logFileUri();
  if (!uri) {
    return [];
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) {
    return [];
  }
  const raw = await FileSystem.readAsStringAsync(uri);
  return parseJsonlLines(raw);
}

/** Writes pretty JSON to cache; returns file URI or null if cache/doc unavailable. */
export async function writeExportJsonFile(): Promise<string | null> {
  const entries = await readErrorLogEntries();
  const cache = FileSystem.cacheDirectory;
  if (!cache) {
    return null;
  }
  const name = `travelog-errors-export-${Date.now()}.json`;
  const uri = `${cache}${name}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(entries, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return uri;
}
