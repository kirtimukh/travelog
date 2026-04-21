import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { openAppDatabase } from "../../src/db/client";
import { getJourneyById } from "../../src/db/journeys";
import { listLocationPointsForJourney } from "../../src/db/locationPoints";
import type { LocationPointRow } from "../../src/db/schema";
import { OfflineJourneyMap } from "../../src/map/OfflineJourneyMap";
import { syncActiveJourneySession } from "../../src/storage/activeJourney";
import { hasValidPmtilesPackage } from "../../src/storage/pmtilesGuard";
import { syncBackgroundTrackingForJourneyStatus } from "../../src/tracking/locationTracking";

export default function JourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const journeyId = Number(id);
  const [name, setName] = useState<string>("Journey");
  const [statusLabel, setStatusLabel] = useState<string>("");
  const [points, setPoints] = useState<LocationPointRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!Number.isFinite(journeyId)) {
        return;
      }
      if (!(await hasValidPmtilesPackage())) {
        router.replace("/");
        return;
      }
      const db = await openAppDatabase();
      const journey = await getJourneyById(db, journeyId);
      if (cancelled || !journey) {
        return;
      }
      setName(journey.name);
      setStatusLabel(journey.status);
      const rows = await listLocationPointsForJourney(db, journeyId);
      setPoints(rows);
      syncActiveJourneySession(journey.id, journey.status);
      await syncBackgroundTrackingForJourneyStatus(journey.status);
    })();
    return () => {
      cancelled = true;
    };
  }, [journeyId, router]);

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-xl font-bold">{name}</Text>
      <Text className="mt-2 text-neutral-600">
        Status: {statusLabel || "—"}
      </Text>
      <View className="mt-4">
        <OfflineJourneyMap points={points} />
      </View>
      <Text className="mt-2 font-mono text-sm text-neutral-500">
        id={id} | points={points.length}
      </Text>
    </View>
  );
}
