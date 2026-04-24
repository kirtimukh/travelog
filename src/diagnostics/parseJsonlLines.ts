import type { ErrorLogEntry } from "./errorLogTypes";

/** Parses JSONL content into entries; skips blank or invalid lines. */
export function parseJsonlLines(content: string): ErrorLogEntry[] {
  const lines = content.split("\n");
  const out: ErrorLogEntry[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const row = JSON.parse(trimmed) as unknown;
      if (!row || typeof row !== "object") {
        continue;
      }
      const o = row as Record<string, unknown>;
      if (
        typeof o.ts !== "string" ||
        typeof o.kind !== "string" ||
        typeof o.name !== "string" ||
        typeof o.message !== "string"
      ) {
        continue;
      }
      out.push(row as ErrorLogEntry);
    } catch {
      continue;
    }
  }
  return out;
}
