import type { JourneyBundle } from "../bundle";
import type { JourneyRow, LocationPointRow, MediaRow, NoteRow } from "../../../db/schema";

export const EXPORT_MAX_BYTES = 300 * 1024 * 1024;

export type ExportMediaRow = Omit<MediaRow, "file"> & { file: string | null };

export type JourneyExportPayload = {
  journey: JourneyRow;
  points: LocationPointRow[];
  notes: NoteRow[];
  media: ExportMediaRow[];
};

export type JourneyExportAsset = {
  sourceUri: string;
  syntheticName: string;
  sizeBytes: number;
};

export type FileSizeProbe = (uri: string) => Promise<{ exists: boolean; size: number }>;

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function sanitizeJourneyNameSegment(name: string): string {
  const s = name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return s.slice(0, 48);
}

export function journeyExportZipFilename(journey: JourneyRow): string {
  const seg = sanitizeJourneyNameSegment(journey.name);
  const core =
    seg.length > 0 ? `travelog_${seg}_${journey.id}` : `travelog_journey_${journey.id}`;
  return `${core}.zip`;
}

export function zipFilenameStemForSaf(zipFilename: string): string {
  return zipFilename.replace(/\.zip$/i, "");
}

export function imageExtensionFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) {
    return ".png";
  }
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) {
    return ".jpg";
  }
  return ".jpg";
}

export function exportTotalBytes(jsonUtf8Bytes: number, fileSizes: readonly number[]): number {
  return jsonUtf8Bytes + fileSizes.reduce((a, b) => a + b, 0);
}

export function exportExceedsMaxBytes(
  jsonUtf8Bytes: number,
  fileSizes: readonly number[],
  capBytes: number = EXPORT_MAX_BYTES,
): boolean {
  return exportTotalBytes(jsonUtf8Bytes, fileSizes) > capBytes;
}

export type PrepareJourneyExportResult = {
  payload: JourneyExportPayload;
  /** Same string used for jsonUtf8Bytes — reuse when writing journey.json to avoid double stringify. */
  jsonString: string;
  assets: JourneyExportAsset[];
  jsonUtf8Bytes: number;
  totalAssetBytes: number;
  /** True when any voice note or media row was missing on disk. */
  hadMissingAssets: boolean;
};

/**
 * Builds export JSON payload and asset list, probing the filesystem for each referenced file.
 */
export async function prepareJourneyExportForZip(
  bundle: JourneyBundle,
  probe: FileSizeProbe,
): Promise<PrepareJourneyExportResult> {
  const assets: JourneyExportAsset[] = [];
  let hadMissingAssets = false;

  const notes: NoteRow[] = await Promise.all(
    bundle.notes.map(async (note) => {
      if (note.type !== "voice") {
        return note;
      }
      if (!note.audio_file) {
        hadMissingAssets = true;
        return { ...note, audio_file: null };
      }
      const info = await probe(note.audio_file);
      if (!info.exists || info.size <= 0) {
        hadMissingAssets = true;
        return { ...note, audio_file: null };
      }
      const syntheticName = `voice-${note.id}.m4a`;
      assets.push({ sourceUri: note.audio_file, syntheticName, sizeBytes: info.size });
      return { ...note, audio_file: syntheticName };
    }),
  );

  const media: ExportMediaRow[] = await Promise.all(
    bundle.media.map(async (row) => {
      if (!row.file) {
        hadMissingAssets = true;
        return { ...row, file: null };
      }
      const info = await probe(row.file);
      if (!info.exists || info.size <= 0) {
        hadMissingAssets = true;
        return { ...row, file: null };
      }
      const ext = imageExtensionFromPath(row.file);
      const syntheticName = `image-${row.id}${ext}`;
      assets.push({ sourceUri: row.file, syntheticName, sizeBytes: info.size });
      return { ...row, file: syntheticName };
    }),
  );

  const payload: JourneyExportPayload = {
    journey: bundle.journey,
    points: bundle.points,
    notes,
    media,
  };

  const jsonString = JSON.stringify(payload);
  const jsonUtf8Bytes = utf8ByteLength(jsonString);
  const totalAssetBytes = assets.reduce((sum, a) => sum + a.sizeBytes, 0);

  return {
    payload,
    jsonString,
    assets,
    jsonUtf8Bytes,
    totalAssetBytes,
    hadMissingAssets,
  };
}
