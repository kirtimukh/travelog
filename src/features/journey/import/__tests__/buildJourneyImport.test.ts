import type { JourneyExportPayload } from "../../export/buildJourneyExport";
import type { JourneyRow, LocationPointRow, MediaRow, NoteRow, WeatherRow } from "../../../../db/schema";
import {
  assertFlatStagingDirectory,
  buildMediaImportPlans,
  buildPreparedVoiceNotes,
  countSkippedNotesFromRawPayload,
  imageExtensionFromBasename,
  isSafeAssetBasename,
  isValidMediaType,
  isValidNoteType,
  normalizeStagingDir,
  parseJourneyImportPayload,
} from "../buildJourneyImport";

function minimalPayload(): JourneyExportPayload {
  const journey: JourneyRow = {
    id: 1,
    name: "Trip",
    description: null,
    start_ts: 100,
    end_ts: 200,
    status: "completed",
    metadata: null,
    journey_duration_ms: 100,
    recorded_duration_ms: 90,
    recorded_distance: 10,
  };
  const points: LocationPointRow[] = [
    {
      id: 1,
      journey_id: 1,
      lat: 1,
      lng: 2,
      timestamp: 150,
      metadata: null,
      speed: null,
      heading: null,
    },
  ];
  return { journey, points, notes: [], media: [], weather: [] };
}

describe("parseJourneyImportPayload", () => {
  it("rejects invalid JSON", () => {
    const r = parseJourneyImportPayload("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Invalid JSON");
    }
  });

  it("rejects missing top-level keys", () => {
    const r = parseJourneyImportPayload(JSON.stringify({ journey: {} }));
    expect(r.ok).toBe(false);
  });

  it("accepts minimal valid payload", () => {
    const p = minimalPayload();
    const r = parseJourneyImportPayload(JSON.stringify(p));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.journey.name).toBe("Trip");
      expect(r.payload.points).toHaveLength(1);
      expect(r.skippedPointsInJson).toBe(0);
    }
  });

  it("defaults journey name when missing", () => {
    const p = minimalPayload();
    p.journey = { ...p.journey, name: "   " };
    const r = parseJourneyImportPayload(JSON.stringify(p));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.journey.name).toBe("Imported journey");
    }
  });

  it("counts skipped points with invalid coordinates", () => {
    const p = minimalPayload();
    p.points = [
      {
        id: 1,
        journey_id: 1,
        lat: 1,
        lng: 2,
        timestamp: 1,
        metadata: null,
        speed: null,
        heading: null,
      },
      { id: 2, journey_id: 1, lat: NaN, lng: 2, timestamp: 2, metadata: null, speed: null, heading: null },
    ];
    const r = parseJourneyImportPayload(JSON.stringify(p));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.points).toHaveLength(1);
      expect(r.skippedPointsInJson).toBe(1);
    }
  });

  it("counts skipped notes with invalid type", () => {
    const p = minimalPayload();
    const r = parseJourneyImportPayload(
      JSON.stringify({
        ...p,
        notes: [{ id: 1, journey_id: 1, timestamp: 1, type: "invalid", text: "x", audio_file: null }],
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.notes).toHaveLength(0);
      expect(r.skippedNotesInJson).toBe(1);
    }
  });

  it("counts skipped media with unsafe basename", () => {
    const p = minimalPayload();
    const media: MediaRow = {
      id: 1,
      journey_id: 1,
      timestamp: 1,
      lat: null,
      lng: null,
      exif: null,
      width: null,
      height: null,
      text: null,
      type: "image",
      file: "../evil.jpg",
    };
    const r = parseJourneyImportPayload(JSON.stringify({ ...p, media: [media] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.media).toHaveLength(0);
      expect(r.skippedMediaInJson).toBe(1);
    }
  });
});

describe("isSafeAssetBasename", () => {
  it("rejects path segments and traversal", () => {
    expect(isSafeAssetBasename("a/b")).toBe(false);
    expect(isSafeAssetBasename("..x")).toBe(false);
    expect(isSafeAssetBasename("file://x")).toBe(false);
    expect(isSafeAssetBasename("")).toBe(false);
  });

  it("accepts export-style names", () => {
    expect(isSafeAssetBasename("voice-1.m4a")).toBe(true);
    expect(isSafeAssetBasename("image-2.jpg")).toBe(true);
  });
});

describe("isValidNoteType / isValidMediaType", () => {
  it("accepts known enums", () => {
    expect(isValidNoteType("voice")).toBe(true);
    expect(isValidNoteType("text")).toBe(true);
    expect(isValidMediaType("image")).toBe(true);
  });
  it("rejects unknown", () => {
    expect(isValidNoteType("video")).toBe(false);
    expect(isValidMediaType("video")).toBe(false);
  });
});

describe("imageExtensionFromBasename", () => {
  it("maps extensions", () => {
    expect(imageExtensionFromBasename("x.PNG")).toBe(".png");
    expect(imageExtensionFromBasename("x.jpg")).toBe(".jpg");
    expect(imageExtensionFromBasename("x")).toBe(".jpg");
  });
});

describe("normalizeStagingDir", () => {
  it("adds trailing slash", () => {
    expect(normalizeStagingDir("/cache/foo")).toBe("/cache/foo/");
  });
});

describe("countSkippedNotesFromRawPayload", () => {
  it("counts non-records and bad types", () => {
    expect(countSkippedNotesFromRawPayload([null, { type: "nope" }])).toBe(2);
  });
});

describe("buildMediaImportPlans", () => {
  const probeOk = async (): Promise<{ exists: boolean; size: number }> => ({
    exists: true,
    size: 100,
  });
  const probeMissing = async (): Promise<{ exists: boolean; size: number }> => ({
    exists: false,
    size: 0,
  });

  it("skips missing files", async () => {
    const media: MediaRow[] = [
      {
        id: 1,
        journey_id: 1,
        timestamp: 1,
        lat: null,
        lng: null,
        exif: null,
        width: null,
        height: null,
        text: null,
        type: "image",
        file: "image-1.jpg",
      },
    ];
    const r = await buildMediaImportPlans(media, "/tmp/stage/", probeMissing);
    expect(r.rows).toHaveLength(0);
    expect(r.skippedMissingFile).toBe(1);
  });

  it("includes rows when probe succeeds", async () => {
    const media: MediaRow[] = [
      {
        id: 1,
        journey_id: 1,
        timestamp: 1,
        lat: null,
        lng: null,
        exif: null,
        width: null,
        height: null,
        text: null,
        type: "image",
        file: "image-1.jpg",
      },
    ];
    const r = await buildMediaImportPlans(media, "/tmp/stage/", probeOk);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].stagingUri).toBe("/tmp/stage/image-1.jpg");
    expect(r.skippedMissingFile).toBe(0);
  });
});

describe("buildPreparedVoiceNotes", () => {
  it("sets voiceStagingUri null when file missing", async () => {
    const notes: NoteRow[] = [
      {
        id: 1,
        journey_id: 1,
        timestamp: 1,
        audio_file: "voice-1.m4a",
        audio_duration: 2,
        audio_transcript: null,
        text: null,
        type: "voice",
      },
    ];
    const r = await buildPreparedVoiceNotes({
      notes,
      stagingDir: "/s/",
      probe: async () => ({ exists: false, size: 0 }),
    });
    expect(r[0].voiceStagingUri).toBeNull();
  });

  it("sets voiceStagingUri when file exists", async () => {
    const notes: NoteRow[] = [
      {
        id: 1,
        journey_id: 1,
        timestamp: 1,
        audio_file: "voice-1.m4a",
        audio_duration: 2,
        audio_transcript: null,
        text: null,
        type: "voice",
      },
    ];
    const r = await buildPreparedVoiceNotes({
      notes,
      stagingDir: "/s/",
      probe: async () => ({ exists: true, size: 10 }),
    });
    expect(r[0].voiceStagingUri).toBe("/s/voice-1.m4a");
  });
});

describe("assertFlatStagingDirectory", () => {
  it("rejects when journey.json missing", async () => {
    const r = await assertFlatStagingDirectory(
      "/x/",
      async () => ["a.jpg"],
      async () => ({ exists: true, isDirectory: false }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects subfolders", async () => {
    const r = await assertFlatStagingDirectory(
      "/x/",
      async () => ["journey.json", "nested"],
      async (p) => ({
        exists: true,
        isDirectory: p.endsWith("nested"),
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("accepts flat layout", async () => {
    const r = await assertFlatStagingDirectory(
      "/x/",
      async () => ["journey.json", "voice-1.m4a"],
      async () => ({ exists: true, isDirectory: false }),
    );
    expect(r.ok).toBe(true);
  });
});
