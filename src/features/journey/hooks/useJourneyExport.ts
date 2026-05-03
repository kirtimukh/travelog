import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { Platform } from "react-native";

import type { JourneyRow } from "../../../db/schema";
import { runJourneyExportAndroid } from "../export/runJourneyExportAndroid";

type Params = {
  journeyId: number;
  journey: JourneyRow | null;
  setScreenError: Dispatch<SetStateAction<string | null>>;
};

export type UseJourneyExportResult = {
  exportBusy: boolean;
  requestExportJourney: () => Promise<void>;
  exportWarning: string | null;
  dismissExportWarning: () => void;
};

export function useJourneyExport({
  journeyId,
  journey,
  setScreenError,
}: Params): UseJourneyExportResult {
  const [exportBusy, setExportBusy] = useState<boolean>(false);
  const [exportWarning, setExportWarning] = useState<string | null>(null);

  const dismissExportWarning = useCallback((): void => {
    setExportWarning(null);
  }, []);

  const requestExportJourney = useCallback(async (): Promise<void> => {
    if (Platform.OS !== "android") {
      return;
    }
    if (!journey || journey.status === "scheduled" || !Number.isFinite(journeyId)) {
      return;
    }
    setExportBusy(true);
    setScreenError(null);
    try {
      const res = await runJourneyExportAndroid(journeyId);
      if (!res.ok) {
        setScreenError(res.error);
        return;
      }
      if (res.hadMissingAssets) {
        setExportWarning(
          "Some voice notes or images were missing on this device. Those entries are null in journey.json.",
        );
      }
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExportBusy(false);
    }
  }, [journey, journeyId, setScreenError]);

  return {
    exportBusy,
    requestExportJourney,
    exportWarning,
    dismissExportWarning,
  };
}
