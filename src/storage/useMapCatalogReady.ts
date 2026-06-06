import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

import { ensureMapCatalogLoaded, getMapCatalogStatusLine } from "./mapCatalog";

export { getMapCatalogStatusLine };

export function useMapCatalogReady(): {
  ready: boolean;
  checking: boolean;
  refresh: () => void;
  cardStatus: string;
  regionCount: number;
} {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [regionCount, setRegionCount] = useState(0);

  const refresh = useCallback((): void => {
    setChecking(true);
    try {
      const catalog = ensureMapCatalogLoaded();
      const count = catalog?.entries.length ?? 0;
      setRegionCount(count);
      setReady(count > 0);
    } finally {
      setChecking(false);
    }
  }, []);

  const cardStatus = useMemo(
    () => getMapCatalogStatusLine(ready, checking, regionCount),
    [ready, checking, regionCount],
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { ready, checking, refresh, cardStatus, regionCount };
}
