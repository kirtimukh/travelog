import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  copyRequiredPmtilesIntoAppDocuments,
  validateRequiredPmtiles,
} from "../files/pmtilesPackage";
import { setPmtilesConfig } from "../storage/pmtilesConfig";

type PmtilesPackageCardProps = {
  status: string;
  onImportSuccess: () => void | Promise<void>;
};

export function PmtilesPackageCard({ status, onImportSuccess }: PmtilesPackageCardProps) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

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
      if (!selected.name.toLowerCase().endsWith(".pmtiles")) {
        setSelectedFile(null);
        setFormSuccess(null);
        setFormError("Please select a file ending in .pmtiles.");
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
      const copied = await copyRequiredPmtilesIntoAppDocuments(
        selectedFile.uri,
        selectedFile.name,
      );
      const validation = await validateRequiredPmtiles(copied.destUri);
      if (!validation.valid) {
        throw new Error(validation.reason ?? "Invalid PMTiles package");
      }
      setPmtilesConfig({
        pmtilesPath: copied.destUri,
        pmtilesFileName: selectedFile.name,
        pmtilesSize: copied.size,
        pmtilesValidatedAt: Date.now(),
        pmtilesHash: copied.hash,
      });
      const successMessage = `Map package imported (${Math.round(copied.size / 1024)} KB).`;
      setFormSuccess(successMessage);
      setSelectedFile(null);
      await onImportSuccess();
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
    <View className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <Text className="text-base font-semibold text-neutral-900">PMTiles package form</Text>
      <Text className="mt-2 font-mono text-xs text-neutral-700">{status}</Text>
      <Text className="mt-3 text-sm text-neutral-800">
        Selected file: {selectedFile?.name ?? "none"}
      </Text>
      {formError ? <Text className="mt-2 text-sm text-red-700">{formError}</Text> : null}
      {formSuccess ? <Text className="mt-2 text-sm text-emerald-700">{formSuccess}</Text> : null}
      <Pressable
        className="mt-4 rounded-md bg-blue-600 px-4 py-3"
        disabled={submitting}
        onPress={() => {
          void pickPmtilesFile();
        }}
      >
        <Text className="text-center font-semibold text-white">Choose a .pmtiles file</Text>
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
  );
}
