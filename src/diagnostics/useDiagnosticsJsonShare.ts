import * as Sharing from "expo-sharing";
import { useCallback, useState } from "react";

import { writeExportJsonFile } from "./errorLogStore";

export type UseDiagnosticsJsonShareResult = {
  busy: boolean;
  error: string | null;
  share: () => Promise<void>;
};

export function useDiagnosticsJsonShare(): UseDiagnosticsJsonShareResult {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = useCallback(async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const uri = await writeExportJsonFile();
      if (!uri) {
        setError("Could not write export file.");
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        setError("Sharing is not available on this device.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        UTI: "public.json",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, share };
}
