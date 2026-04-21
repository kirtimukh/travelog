import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { openAppDatabase } from "../../src/db/client";
import { getJourneyById } from "../../src/db/journeys";
import { syncActiveJourneySession } from "../../src/storage/activeJourney";
import { syncBackgroundTrackingForJourneyStatus } from "../../src/tracking/locationTracking";

export default function JourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const journeyId = Number(id);
  const [name, setName] = useState<string>("Journey");
  const [statusLabel, setStatusLabel] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!Number.isFinite(journeyId)) {
        return;
      }
      const db = await openAppDatabase();
      const journey = await getJourneyById(db, journeyId);
      if (cancelled || !journey) {
        return;
      }
      setName(journey.name);
      setStatusLabel(journey.status);
      syncActiveJourneySession(journey.id, journey.status);
      await syncBackgroundTrackingForJourneyStatus(journey.status);
    })();
    return () => {
      cancelled = true;
    };
  }, [journeyId]);

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-xl font-bold">{name}</Text>
      <Text className="mt-2 text-neutral-600">
        Status: {statusLabel || "—"}
      </Text>
      <Text className="mt-2 font-mono text-sm text-neutral-500">
        id={id}
      </Text>
    </View>
  );
}
