import type { JourneyBundle } from "../../bundle";
import {
  EXPORT_MAX_BYTES,
  exportExceedsMaxBytes,
  exportTotalBytes,
  imageExtensionFromPath,
  journeyExportZipFilename,
  prepareJourneyExportForZip,
  sanitizeJourneyNameSegment,
  utf8ByteLength,
  zipFilenameStemForSaf,
} from "../buildJourneyExport";
import type { JourneyRow, LocationPointRow, MediaRow, NoteRow, WeatherRow } from "../../../../db/schema";

function rowJourney(over: Partial<JourneyRow> = {}): JourneyRow {
  return {
    id: 7,
    name: "Test Trip",
    description: null,
    start_ts: 1,
    end_ts: 2,
    status: "completed",
    metadata: null,
    journey_duration_ms: 100,
    recorded_duration_ms: 90,
    recorded_distance: 50,
    ...over,
  };
}

function bundleFrom(over: Partial<JourneyBundle> = {}): JourneyBundle {
  return {
    journey: rowJourney(),
    points: [] as LocationPointRow[],
    notes: [] as NoteRow[],
    media: [] as MediaRow[],
    weather: [] as WeatherRow[],
    ...over,
  };
}

describe("sanitizeJourneyNameSegment", () => {
  it("keeps alphanumerics and underscores", () => {
    expect(sanitizeJourneyNameSegment("  Hello / World  ")).toBe("Hello_World");
  });

  it("truncates long names", () => {
    const long = "a".repeat(80);
    expect(sanitizeJourneyNameSegment(long).length).toBeLessThanOrEqual(48);
  });

  it("returns empty for symbols-only", () => {
    expect(sanitizeJourneyNameSegment("///")).toBe("");
  });
});

describe("journeyExportZipFilename", () => {
  it("uses travelog_journey_id when name sanitizes empty", () => {
    expect(journeyExportZipFilename(rowJourney({ id: 3, name: "///" }))).toBe(
      "travelog_journey_3.zip",
    );
  });

  it("includes sanitized name and id", () => {
    expect(journeyExportZipFilename(rowJourney({ id: 12, name: "Coastal Walk" }))).toBe(
      "travelog_Coastal_Walk_12.zip",
    );
  });
});

describe("zipFilenameStemForSaf", () => {
  it("strips zip extension", () => {
    expect(zipFilenameStemForSaf("travelog_foo_1.zip")).toBe("travelog_foo_1");
  });
});

describe("imageExtensionFromPath", () => {
  it("detects png and jpg", () => {
    expect(imageExtensionFromPath("file:///x/abc.PNG")).toBe(".png");
    expect(imageExtensionFromPath("/p/q.jpeg")).toBe(".jpg");
  });
});

describe("utf8ByteLength and size cap", () => {
  it("counts UTF-8 bytes", () => {
    expect(utf8ByteLength("a")).toBe(1);
    expect(utf8ByteLength("é")).toBe(2);
  });

  it("exportTotalBytes sums json and files", () => {
    expect(exportTotalBytes(100, [50, 25])).toBe(175);
  });

  it("exportExceedsMaxBytes respects cap", () => {
    expect(exportExceedsMaxBytes(1, [2], 3)).toBe(false);
    expect(exportExceedsMaxBytes(1, [2], 2)).toBe(true);
    expect(exportExceedsMaxBytes(EXPORT_MAX_BYTES, [1], EXPORT_MAX_BYTES)).toBe(true);
  });
});

describe("prepareJourneyExportForZip", () => {
  const probeOk = async () => ({ exists: true, size: 10 });
  const probeMissing = async () => ({ exists: false, size: 0 });

  it("assigns synthetic audio and image names when files exist", async () => {
    const bundle = bundleFrom({
      notes: [
        {
          id: 1,
          journey_id: 7,
          timestamp: 1,
          audio_file: "file:///v.m4a",
          audio_duration: 2,
          audio_transcript: null,
          text: null,
          type: "voice",
        },
      ],
      media: [
        {
          id: 2,
          journey_id: 7,
          timestamp: 1,
          lat: 0,
          lng: 0,
          exif: null,
          width: 1,
          height: 1,
          text: null,
          type: "image",
          file: "file:///i.png",
        },
      ],
    });
    const res = await prepareJourneyExportForZip(bundle, probeOk);
    expect(res.jsonString).toBe(JSON.stringify(res.payload));
    expect(res.assets).toHaveLength(2);
    expect(res.payload.notes[0].audio_file).toBe("voice-1.m4a");
    expect(res.payload.media[0].file).toBe("image-2.png");
    expect(res.hadMissingAssets).toBe(false);
  });

  it("nulls missing voice file and sets hadMissingAssets", async () => {
    const bundle = bundleFrom({
      notes: [
        {
          id: 9,
          journey_id: 7,
          timestamp: 1,
          audio_file: "file:///gone.m4a",
          audio_duration: 1,
          audio_transcript: null,
          text: null,
          type: "voice",
        },
      ],
    });
    const res = await prepareJourneyExportForZip(bundle, probeMissing);
    expect(res.assets).toHaveLength(0);
    expect(res.payload.notes[0].audio_file).toBeNull();
    expect(res.hadMissingAssets).toBe(true);
  });
});
