import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { openAppDatabase } from "../src/db/client";
import {
  createJourney,
  getMainScreenJourneyCandidate,
} from "../src/db/journeys";
import type { JourneyRow } from "../src/db/schema";
import {
  copyRequiredPmtilesIntoAppDocuments,
  validateRequiredPmtiles,
} from "../src/files/pmtilesPackage";
import {
  getPmtilesConfig,
  REQUIRED_PMTILES_FILENAME,
  setPmtilesConfig,
} from "../src/storage/pmtilesConfig";
import { AppHeaderMenu } from "../src/components/AppHeaderMenu";
import { HeaderBackButton } from "../src/components/HeaderBackButton";
import { useOngoingJourneyCandidate } from "../src/features/journey/useOngoingJourneyCandidate";

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { ongoingJourneyId } = useOngoingJourneyCandidate();
  const [status, setStatus] = useState<string>("Checking map package...");
  const [ready, setReady] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [candidateJourney, setCandidateJourney] = useState<JourneyRow | null>(null);
  const [candidateLoading, setCandidateLoading] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [creatingJourney, setCreatingJourney] = useState<boolean>(false);

  const refreshCandidateJourney = useCallback(async (): Promise<void> => {
    setCandidateLoading(true);
    try {
      const db = await openAppDatabase();
      const candidate = await getMainScreenJourneyCandidate(db);
      setCandidateJourney(candidate);
    } catch {
      setCandidateJourney(null);
    } finally {
      setCandidateLoading(false);
    }
  }, []);

  useEffect(() => {
    const cfg = getPmtilesConfig();
    if (!cfg?.pmtilesPath) {
      setReady(false);
      setStatus(
        `Upload ${REQUIRED_PMTILES_FILENAME} to continue to map-enabled journeys.`,
      );
      return;
    }
    setReady(true);
    setStatus(`Map package ready: ${cfg.pmtilesFileName}`);
    void refreshCandidateJourney();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!ready) {
        return;
      }
      void refreshCandidateJourney();
    }, [ready, refreshCandidateJourney]),
  );

  useEffect(() => {
    if (!ready || candidateLoading || !candidateJourney) {
      return;
    }
    if (
      candidateJourney.status === "ongoing" ||
      candidateJourney.status === "paused"
    ) {
      router.replace(`/journey/${candidateJourney.id}`);
    }
  }, [candidateJourney, candidateLoading, ready, router]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => <HeaderBackButton isHomeScreen />,
      headerRight: () => (
        <AppHeaderMenu
          showHome={false}
          showHistory
          ongoingJourneyId={ongoingJourneyId}
        />
      ),
    });
  }, [navigation, ongoingJourneyId]);

  async function pickPmtilesFile(): Promise<void> {
    if (submitting) {
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) {
        setFormError("File selection canceled.");
        return;
      }
      const selected = result.assets[0];
      if (selected.name !== REQUIRED_PMTILES_FILENAME) {
        setSelectedFile(null);
        setFormSuccess(null);
        setFormError(`Please select exactly ${REQUIRED_PMTILES_FILENAME}.`);
        return;
      }
      setFormError(null);
      setFormSuccess(null);
      setSelectedFile({
        name: selected.name,
        uri: selected.uri,
      });
    } catch {
      setFormError("Failed to open file picker. Try again.");
    }
  }

  async function submitPmtilesImport(): Promise<void> {
    if (!selectedFile || submitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const copied = await copyRequiredPmtilesIntoAppDocuments(selectedFile.uri);
      const validation = await validateRequiredPmtiles(copied.destUri);
      if (!validation.valid) {
        throw new Error(validation.reason ?? "Invalid PMTiles package");
      }
      setPmtilesConfig({
        pmtilesPath: copied.destUri,
        pmtilesFileName: REQUIRED_PMTILES_FILENAME,
        pmtilesSize: copied.size,
        pmtilesValidatedAt: Date.now(),
        pmtilesHash: copied.hash,
      });
      setReady(true);
      const successMessage = `Map package imported (${Math.round(copied.size / 1024)} KB).`;
      setStatus(successMessage);
      setFormSuccess(successMessage);
      setSelectedFile(null);
      await refreshCandidateJourney();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to import map package. Try again.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

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
      setCandidateJourney({
        id: newId,
        name: trimmedName,
        description: trimmedDescription,
        start_ts: null,
        end_ts: null,
        status: "scheduled",
      });
      setName("");
      setDescription("");
      router.push(`/journey/${newId}`);
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
      <Text className="mt-2 text-sm text-neutral-700">
        Upload {REQUIRED_PMTILES_FILENAME} to unlock map-enabled journeys.
      </Text>
      {ready ? (
        <Pressable
          className="mt-4 self-start rounded-md bg-neutral-800 px-4 py-2"
          onPress={() => {
            router.push("/journeys");
          }}
        >
          <Text className="font-semibold text-white">View all journeys</Text>
        </Pressable>
      ) : null}
      <View className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <Text className="text-base font-semibold text-neutral-900">
          PMTiles package form
        </Text>
        <Text className="mt-2 font-mono text-xs text-neutral-700">{status}</Text>
        <Text className="mt-3 text-sm text-neutral-800">
          Selected file: {selectedFile?.name ?? "none"}
        </Text>
        {formError ? (
          <Text className="mt-2 text-sm text-red-700">{formError}</Text>
        ) : null}
        {formSuccess ? (
          <Text className="mt-2 text-sm text-emerald-700">{formSuccess}</Text>
        ) : null}
        <Pressable
          className="mt-4 rounded-md bg-blue-600 px-4 py-3"
          disabled={submitting}
          onPress={() => {
            void pickPmtilesFile();
          }}
        >
          <Text className="text-center font-semibold text-white">
            Choose {REQUIRED_PMTILES_FILENAME}
          </Text>
        </Pressable>
        <Pressable
          className={`mt-3 rounded-md px-4 py-3 ${selectedFile ? "bg-emerald-600" : "bg-neutral-300"}`}
          disabled={!selectedFile || submitting}
          onPress={() => {
            void submitPmtilesImport();
          }}
        >
          <Text className="text-center font-semibold text-white">
            {submitting ? "Importing..." : "Load PMTiles into app"}
          </Text>
        </Pressable>
      </View>
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
            onPress={() => router.push(`/journey/${candidateJourney.id}`)}
          >
            <Text className="text-center font-semibold text-white">
              {candidateActionLabel}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <Text className="text-base font-semibold text-neutral-900">
            New journey
          </Text>
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
