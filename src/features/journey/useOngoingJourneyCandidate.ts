import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { openAppDatabase } from "../../db/client";
import { getMainScreenJourneyCandidate } from "../../db/journeys";

export function useOngoingJourneyCandidate() {
  const [ongoingJourneyId, setOngoingJourneyId] = useState<number | null>(null);

  const refreshOngoingJourney = useCallback(async (): Promise<void> => {
    try {
      const db = await openAppDatabase();
      const candidate = await getMainScreenJourneyCandidate(db);
      setOngoingJourneyId(candidate?.id ?? null);
    } catch {
      setOngoingJourneyId(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshOngoingJourney();
    }, [refreshOngoingJourney]),
  );

  return {
    ongoingJourneyId,
    refreshOngoingJourney,
  };
}
