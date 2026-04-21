import { Pressable, Text, View } from "react-native";

import type { LocationPointRow } from "../../../db/schema";
import { OfflineJourneyMap } from "../../../map/OfflineJourneyMap";

type Props = {
  points: LocationPointRow[];
  hasLocationPermission: boolean;
  onGrantLocation: () => void;
};

export function JourneyMapPanel({
  points,
  hasLocationPermission,
  onGrantLocation,
}: Props) {
  if (hasLocationPermission) {
    return <OfflineJourneyMap points={points} />;
  }

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
