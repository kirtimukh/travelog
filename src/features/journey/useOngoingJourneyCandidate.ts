import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { openAppDatabase } from "../../db/client";
import { getMainScreenJourneyCandidate } from "../../db/journeys";
import type { JourneyRow } from "../../db/schema";

export type UseOngoingJourneyCandidateOptions = {
  /** When true, skips the focus-driven refresh (e.g. Home until map package is ready). */
  skipFocusRefresh?: boolean;
};

export function useOngoingJourneyCandidate(
  options?: UseOngoingJourneyCandidateOptions,
) {
  const skipFocusRefresh = options?.skipFocusRefresh ?? false;
  const [candidateJourney, setMainScreenCandidate] = useState<JourneyRow | null>(
    null,
  );
  const [candidateLoading, setCandidateLoading] = useState<boolean>(false);

  const refreshOngoingJourney = useCallback(async (): Promise<void> => {
    setCandidateLoading(true);
    try {
      const db = await openAppDatabase();
      const candidate = await getMainScreenJourneyCandidate(db);
      setMainScreenCandidate(candidate);
    } catch {
      setMainScreenCandidate(null);
    } finally {
      setCandidateLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusRefresh) {
        return;
      }
      void refreshOngoingJourney();
    }, [skipFocusRefresh, refreshOngoingJourney]),
  );

  const ongoingJourneyId = candidateJourney?.id ?? null;

  return {
    candidateJourney,
    ongoingJourneyId,
    candidateLoading,
    refreshOngoingJourney,
  };
}
