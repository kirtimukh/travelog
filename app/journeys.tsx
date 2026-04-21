import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { openAppDatabase } from "../src/db/client";
import {
  deleteJourneyWithFileGc,
  listJourneysWithFilters,
} from "../src/db/journeys";
import type { JourneyRow, JourneyStatus } from "../src/db/schema";

type StatusFilter = JourneyStatus | "all";

const STATUS_OPTIONS: StatusFilter[] = [
  "all",
  "scheduled",
  "ongoing",
  "paused",
  "completed",
  "abandoned",
];

function parseInputDate(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const ts = Date.parse(`${trimmed}T00:00:00`);
  return Number.isFinite(ts) ? ts : Number.NaN;
}

function formatTimestamp(ts: number | null): string {
  if (ts == null) {
    return "—";
  }
  return new Date(ts).toLocaleString();
}

export default function JourneysScreen() {
  const router = useRouter();
  const [journeys, setJourneys] = useState<JourneyRow[]>([]);
  const [nameFilter, setNameFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [inputDateText, setInputDateText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const parsedInputDate = useMemo(
    () => parseInputDate(inputDateText),
    [inputDateText],
  );
  const hasInvalidDate = Number.isNaN(parsedInputDate);

  const refreshJourneys = useCallback(async (): Promise<void> => {
    if (hasInvalidDate) {
      setJourneys([]);
      setError("Date must be in YYYY-MM-DD format.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const db = await openAppDatabase();
      const rows = await listJourneysWithFilters(db, {
        name: nameFilter,
        status: statusFilter,
        inputDateTs: parsedInputDate,
      });
      setJourneys(rows);
    } catch {
      setError("Failed to load journeys.");
      setJourneys([]);
    } finally {
      setLoading(false);
    }
  }, [hasInvalidDate, nameFilter, parsedInputDate, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      void refreshJourneys();
    }, [refreshJourneys]),
  );

  const onDeleteJourney = useCallback(
    (journey: JourneyRow): void => {
      if (deletingId != null) {
        return;
      }
      Alert.alert(
        "Delete journey?",
        `This will remove "${journey.name}" and all associated notes, media, and location points.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            style: "destructive",
            onPress: () => {
              Alert.alert(
                "Final confirmation",
                "This action is permanent and cannot be undone. Delete this journey now?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete permanently",
                    style: "destructive",
                    onPress: () => {
                      void (async () => {
                        setDeletingId(journey.id);
                        setError(null);
                        try {
                          const db = await openAppDatabase();
                          await deleteJourneyWithFileGc(db, journey.id);
                          await refreshJourneys();
                        } catch {
                          setError("Failed to delete journey.");
                        } finally {
                          setDeletingId(null);
                        }
                      })();
                    },
                  },
                ],
              );
            },
          },
        ],
      );
    },
    [deletingId, refreshJourneys],
  );

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-xl font-bold text-blue-600">Journeys</Text>
      <Text className="mt-2 text-sm text-neutral-700">
        Filter by name, status, and date to find journeys quickly.
      </Text>

      <View className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <TextInput
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          placeholder="Filter by journey name"
          value={nameFilter}
          onChangeText={setNameFilter}
          onSubmitEditing={() => {
            void refreshJourneys();
          }}
        />

        <Text className="mt-3 text-xs font-semibold uppercase text-neutral-500">
          Status
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => {
            const selected = statusFilter === status;
            return (
              <Pressable
                key={status}
                className={`rounded-full border px-3 py-1 ${selected ? "border-blue-600 bg-blue-600" : "border-neutral-300 bg-white"}`}
                onPress={() => {
                  setStatusFilter(status);
                }}
              >
                <Text
                  className={`text-xs font-medium ${selected ? "text-white" : "text-neutral-700"}`}
                >
                  {status}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          className="mt-3 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          placeholder="Filter date (YYYY-MM-DD)"
          value={inputDateText}
          onChangeText={setInputDateText}
          onSubmitEditing={() => {
            void refreshJourneys();
          }}
        />
        {hasInvalidDate ? (
          <Text className="mt-2 text-xs text-red-700">
            Enter date as YYYY-MM-DD.
          </Text>
        ) : null}

        <Pressable
          className={`mt-4 rounded-md px-4 py-3 ${loading ? "bg-neutral-300" : "bg-blue-600"}`}
          disabled={loading || hasInvalidDate}
          onPress={() => {
            void refreshJourneys();
          }}
        >
          <Text className="text-center font-semibold text-white">
            {loading ? "Applying filters..." : "Apply filters"}
          </Text>
        </Pressable>
      </View>

      {error ? <Text className="mt-3 text-sm text-red-700">{error}</Text> : null}

      <ScrollView className="mt-4 flex-1">
        {journeys.length === 0 && !loading ? (
          <Text className="text-sm text-neutral-600">No journeys found.</Text>
        ) : null}
        {journeys.map((journey) => {
          const deleting = deletingId === journey.id;
          return (
            <View
              key={journey.id}
              className="mb-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <Text className="text-base font-semibold text-neutral-900">
                {journey.name}
              </Text>
              <Text className="mt-1 text-xs text-neutral-600">
                Status: {journey.status}
              </Text>
              <Text className="mt-1 text-xs text-neutral-600">
                Start: {formatTimestamp(journey.start_ts)}
              </Text>
              <Text className="mt-1 text-xs text-neutral-600">
                End: {formatTimestamp(journey.end_ts)}
              </Text>

              {journey.description ? (
                <Text className="mt-2 text-sm text-neutral-700">
                  {journey.description}
                </Text>
              ) : null}

              <View className="mt-3 flex-row gap-2">
                <Pressable
                  className="flex-1 rounded-md bg-emerald-600 px-3 py-2"
                  onPress={() => {
                    router.push(`/journey/${journey.id}`);
                  }}
                >
                  <Text className="text-center font-semibold text-white">
                    Open journey
                  </Text>
                </Pressable>
                <Pressable
                  className="flex-1 rounded-md bg-blue-600 px-3 py-2"
                  onPress={() => {
                    router.push(`/journey/details/${journey.id}`);
                  }}
                >
                  <Text className="text-center font-semibold text-white">
                    Open details
                  </Text>
                </Pressable>
              </View>
              <View className="mt-2 flex-row gap-2">
                <Pressable
                  className={`flex-1 rounded-md px-3 py-2 ${deleting ? "bg-neutral-300" : "bg-red-700"}`}
                  disabled={deleting}
                  onPress={() => {
                    onDeleteJourney(journey);
                  }}
                >
                  <Text className="text-center font-semibold text-white">
                    {deleting ? "Deleting..." : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
