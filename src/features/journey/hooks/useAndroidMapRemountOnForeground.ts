import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

/**
 * MapLibre on Android can leave the GL surface in a bad state after resume from
 * background; bumping the key remounts the map when returning to active.
 */
export function useAndroidMapRemountOnForeground(): number {
  const [mapRemountKey, setMapRemountKey] = useState(0);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (Platform.OS !== "android") {
        return;
      }
      if (next === "active" && (prev === "background" || prev === "inactive")) {
        setMapRemountKey((k) => k + 1);
      }
    });
    return () => sub.remove();
  }, []);

  return mapRemountKey;
}
