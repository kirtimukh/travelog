import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";

import type { LocationPointRow } from "../../../../db/schema";
import { JourneyMapPanel } from "../JourneyMapPanel";
import type { UseJourneyDetailsReplayResult } from "../../hooks/useJourneyDetailsReplay";

type Props = {
  mapNativeGesture: UseJourneyDetailsReplayResult["mapNativeGesture"];
  replayPath: LocationPointRow[];
  replayPoint: LocationPointRow | null;
  hasLocationPermission: boolean;
  onGrantLocation: () => void;
};

export function JourneyDetailsMapSection({
  mapNativeGesture,
  replayPath,
  replayPoint,
  hasLocationPermission,
  onGrantLocation,
}: Props) {
  return (
    <View className="mt-4">
      <GestureDetector gesture={mapNativeGesture}>
        <View collapsable={false}>
          <JourneyMapPanel
            points={replayPath}
            markerHead={replayPoint}
            hasLocationPermission={hasLocationPermission}
            onGrantLocation={onGrantLocation}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
