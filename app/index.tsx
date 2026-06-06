import { useNavigation, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { openAppDatabase } from "../src/db/client";
import { createJourney } from "../src/db/journeys";
import { AppHeaderMenu } from "../src/components/AppHeaderMenu";
import { HeaderBackButton } from "../src/components/HeaderBackButton";
import { useOngoingJourneyCandidate } from "../src/features/journey/useOngoingJourneyCandidate";
import { useMapCatalogReady } from "../src/storage/useMapCatalogReady";

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { ready, checking, regionCount } = useMapCatalogReady();
  const {
    candidateJourney,
    ongoingJourneyId,
    candidateLoading,
    refreshOngoingJourney,
  } = useOngoingJourneyCandidate({ skipFocusRefresh: !ready });
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [creatingJourney, setCreatingJourney] = useState<boolean>(false);

  useEffect(() => {
    if (ready) {
      void refreshOngoingJourney();
    }
  }, [ready, refreshOngoingJourney]);

  useEffect(() => {
    navigation.setOptions({
      title: "Travelog",
      headerLeft: () => <HeaderBackButton isHomeScreen />,
      headerRight: () => (
        <AppHeaderMenu
          showHome={false}
          showHistory
          showAdvanced
          ongoingJourneyId={ongoingJourneyId}
        />
      ),
    });
  }, [navigation, ongoingJourneyId]);

  async function submitNewJourney(): Promise<void> {
    if (creatingJourney) {
      return;
    }
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || !trimmedDescription) {
      setJourneyError("Name and description are required.");
      return;
    }
    setJourneyError(null);
    setCreatingJourney(true);
    try {
      const db = await openAppDatabase();
      const newId = await createJourney(db, {
        name: trimmedName,
        description: trimmedDescription,
      });
      setName("");
      setDescription("");
      router.navigate(`/journey/${newId}`);
    } catch {
      setJourneyError("Failed to create journey. Try again.");
    } finally {
      setCreatingJourney(false);
    }
  }

  const candidateActionLabel =
    candidateJourney?.status === "scheduled" ? "Start Journey" : "Continue Journey";

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-xl font-bold text-blue-600">Home</Text>
      {ready ? (
        <Text className="mt-2 text-sm text-neutral-700">
          {regionCount} regions available
        </Text>
      ) : checking ? (
        <Text className="mt-2 text-sm text-neutral-600">Loading map catalog...</Text>
      ) : (
        <Text className="mt-2 text-sm text-red-700">Map catalog unavailable.</Text>
      )}
      {ready ? (
        <Pressable
          className="mt-4 self-start rounded-md bg-neutral-800 px-4 py-2"
          onPress={() => {
            router.navigate("/journeys");
          }}
        >
          <Text className="font-semibold text-white">View all journeys</Text>
        </Pressable>
      ) : null}
      {!ready ? null : candidateLoading ? (
        <Text className="mt-6 text-sm text-neutral-600">Loading journey...</Text>
      ) : candidateJourney ? (
        <View className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <Text className="text-base font-semibold text-neutral-900">
            {candidateJourney.name}
          </Text>
          <Text className="mt-1 text-sm text-neutral-700">
            Status: {candidateJourney.status}
          </Text>
          {candidateJourney.description ? (
            <Text className="mt-2 text-sm text-neutral-600">
              {candidateJourney.description}
            </Text>
          ) : null}
          <Pressable
            className="mt-4 rounded-md bg-emerald-600 px-4 py-3"
            onPress={() => router.navigate(`/journey/${candidateJourney.id}`)}
          >
            <Text className="text-center font-semibold text-white">
              {candidateActionLabel}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <Text className="text-base font-semibold text-neutral-900">New journey</Text>
          <TextInput
            className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
            placeholder="Name"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          {journeyError ? (
            <Text className="mt-2 text-sm text-red-700">{journeyError}</Text>
          ) : null}
          <Pressable
            className={`mt-4 rounded-md px-4 py-3 ${creatingJourney ? "bg-neutral-300" : "bg-blue-600"}`}
            disabled={creatingJourney}
            onPress={() => {
              void submitNewJourney();
            }}
          >
            <Text className="text-center font-semibold text-white">
              {creatingJourney ? "Creating..." : "Create Journey"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
