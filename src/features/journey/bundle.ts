import { openAppDatabase } from "../../db/client";
import { getJourneyById } from "../../db/journeys";
import { listLocationPointsForJourney } from "../../db/locationPoints";
import { listMediaForJourney } from "../../db/media";
import { listNotesForJourney } from "../../db/notes";
import type { JourneyRow, LocationPointRow, MediaRow, NoteRow } from "../../db/schema";

export type JourneyBundle = {
  journey: JourneyRow;
  points: LocationPointRow[];
  notes: NoteRow[];
  media: MediaRow[];
};

export async function loadJourneyBundle(
  journeyId: number,
): Promise<JourneyBundle | null> {
  const db = await openAppDatabase();
  const journey = await getJourneyById(db, journeyId);
  if (!journey) {
    return null;
  }

  const [points, notes, media] = await Promise.all([
    listLocationPointsForJourney(db, journeyId),
    listNotesForJourney(db, journeyId),
    listMediaForJourney(db, journeyId),
  ]);

  return {
    journey,
    points,
    notes,
    media,
  };
}
