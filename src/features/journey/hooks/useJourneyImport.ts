import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Platform } from "react-native";

import { setJourneyImportFeedback } from "../import/journeyImportFeedback";
import { runJourneyImportAndroid } from "../import/runJourneyImportAndroid";

type Params = {
  setScreenError: Dispatch<SetStateAction<string | null>>;
  onImportSuccess: (result: { journeyId: number }) => void;
};

export type UseJourneyImportResult = {
  importBusy: boolean;
  requestImportJourney: (() => Promise<void>) | undefined;
  cancelImportJourney: (() => void) | undefined;
};

export function useJourneyImport({
  setScreenError,
  onImportSuccess,
}: Params): UseJourneyImportResult {
  const [importBusy, setImportBusy] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancelImportJourney = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  const runImport = useCallback(async (): Promise<void> => {
    setImportBusy(true);
    setScreenError(null);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    try {
      const res = await runJourneyImportAndroid({ signal });
      if (!res.ok) {
        if (res.cancelled) {
          setScreenError(null);
          return;
        }
        setScreenError(res.error);
        return;
      }
      setJourneyImportFeedback({
        complete: true,
        skippedRowCount: res.skippedRowCount,
        missingAssetCount: res.missingAssetCount,
      });
      onImportSuccess({ journeyId: res.journeyId });
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImportBusy(false);
      abortRef.current = null;
    }
  }, [onImportSuccess, setScreenError]);

  const isAndroid = Platform.OS === "android";

  return {
    importBusy,
    requestImportJourney: isAndroid ? runImport : undefined,
    cancelImportJourney: isAndroid ? cancelImportJourney : undefined,
  };
}
