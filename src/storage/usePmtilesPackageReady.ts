import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

import { getPmtilesConfig } from "./pmtilesConfig";
import { hasValidPmtilesPackage } from "./pmtilesGuard";

export function getPmtilesCardStatusLine(ready: boolean, checking: boolean): string {
  if (checking) {
    return "Checking map package...";
  }
  if (!ready) {
    return "Upload a .pmtiles file to continue to map-enabled journeys.";
  }
  const cfg = getPmtilesConfig();
  if (cfg?.pmtilesFileName) {
    return `Map package ready: ${cfg.pmtilesFileName}`;
  }
  return "Upload a .pmtiles file to continue to map-enabled journeys.";
}

export function usePmtilesPackageReady(): {
  ready: boolean;
  checking: boolean;
  refresh: () => Promise<void>;
  cardStatus: string;
} {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  const cardStatus = useMemo(
    () => getPmtilesCardStatusLine(ready, checking),
    [ready, checking],
  );

  const refresh = useCallback(async (): Promise<void> => {
    setChecking(true);
    try {
      const ok = await hasValidPmtilesPackage();
      setReady(ok);
    } finally {
      setChecking(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { ready, checking, refresh, cardStatus };
}
