import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  copyRequiredPmtilesIntoAppDocuments,
  validateRequiredPmtiles,
} from "../src/files/pmtilesPackage";
import {
  getPmtilesConfig,
  REQUIRED_PMTILES_FILENAME,
  setPmtilesConfig,
} from "../src/storage/pmtilesConfig";

export default function HomeScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("Checking map package...");
  const [ready, setReady] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

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
  }, []);

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

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-xl font-bold text-blue-600">Home</Text>
      <Text className="mt-2 text-sm text-neutral-700">
        Upload {REQUIRED_PMTILES_FILENAME} to unlock map-enabled journeys.
      </Text>
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
      <Pressable
        className={`mt-6 rounded-md px-4 py-3 ${ready ? "bg-emerald-600" : "bg-neutral-300"}`}
        disabled={!ready}
        onPress={() => router.push("/journey/1")}
      >
        <Text className="text-center font-semibold text-white">
          Continue to journey
        </Text>
      </Pressable>
    </View>
  );
}
