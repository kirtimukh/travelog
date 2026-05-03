import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";

import type { LocationPointRow } from "../../../db/schema";
import { OfflineJourneyMap } from "../../../map/OfflineJourneyMap";

type Props = {
  points: LocationPointRow[];
  hasLocationPermission: boolean;
  onGrantLocation: () => void;
  markerHead?: LocationPointRow | null;
  fallbackLngLat?: { lat: number; lng: number } | null;
  fallbackMarkerVariant?: "default" | "scheduledCurrentLocation";
};

export function JourneyMapPanel({
  points,
  hasLocationPermission,
  onGrantLocation,
  markerHead,
  fallbackLngLat,
  fallbackMarkerVariant,
}: Props) {
  const [mapRemountKey, setMapRemountKey] = useState(0);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (Platform.OS !== "android") {
        return;
      }
      if (
        next === "active" &&
        (prev === "background" || prev === "inactive")
      ) {
        setMapRemountKey((k) => k + 1);
      }
    });
    return () => sub.remove();
  }, []);

  if (!hasLocationPermission) {
    return (
      <View className="h-64 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 px-4">
        <Text className="text-center text-sm text-neutral-700">
          Location permission is required to render the map.
        </Text>
        <Pressable
          className="mt-4 rounded-md bg-blue-600 px-4 py-2"
          onPress={onGrantLocation}
        >
          <Text className="font-semibold text-white">Grant location</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <OfflineJourneyMap
      key={mapRemountKey}
      points={points}
      markerHead={markerHead}
      fallbackLngLat={fallbackLngLat}
      fallbackMarkerVariant={fallbackMarkerVariant}
    />
  );
}
