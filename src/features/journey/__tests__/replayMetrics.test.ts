import type { JourneyRow } from "../../../db/schema";
import {
  computeRecordedDurationMs,
  getReplayRecordedDurationMs,
  getStoredOrComputedJourneyDurationMs,
  mapWallTsToRecordedElapsedMs,
} from "../replay";

function journey(partial: Partial<JourneyRow> & Pick<JourneyRow, "start_ts" | "end_ts" | "status">): JourneyRow {
  return {
    id: 1,
    name: "t",
    description: null,
    metadata: null,
    journey_duration_ms: null,
    recorded_duration_ms: null,
    recorded_distance: null,
    ...partial,
  };
}

describe("replay journey metrics", () => {
  it("computeRecordedDurationMs subtracts normalized pause time", () => {
    const j = journey({
      start_ts: 1_000,
      end_ts: 5_000,
      status: "completed",
      metadata: JSON.stringify({
        pauseWindows: [{ startTs: 2_000, endTs: 3_000 }],
      }),
    });
    expect(computeRecordedDurationMs(j, 9_999)).toBe(3_000);
  });

  it("getReplayRecordedDurationMs uses stored recorded_duration_ms when completed", () => {
    const j = journey({
      start_ts: 1_000,
      end_ts: 5_000,
      status: "completed",
      metadata: null,
      recorded_duration_ms: 9_999,
    });
    expect(getReplayRecordedDurationMs(j, 9_999)).toBe(9_999);
  });

  it("getStoredOrComputedJourneyDurationMs uses stored journey_duration_ms when completed", () => {
    const j = journey({
      start_ts: 1_000,
      end_ts: 5_000,
      status: "completed",
      journey_duration_ms: 12_345,
    });
    expect(getStoredOrComputedJourneyDurationMs(j, 9_999)).toBe(12_345);
  });

  it("mapWallTsToRecordedElapsedMs at end returns stored recorded_duration_ms", () => {
    const j = journey({
      start_ts: 1_000,
      end_ts: 5_000,
      status: "completed",
      metadata: JSON.stringify({
        pauseWindows: [{ startTs: 2_000, endTs: 3_000 }],
      }),
      recorded_duration_ms: 3_000,
    });
    expect(mapWallTsToRecordedElapsedMs(j, 5_000, 9_999)).toBe(3_000);
  });
});
