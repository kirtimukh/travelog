import { useNavigation } from "expo-router";
import { useEffect } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { HeaderBackButton } from "../src/components/HeaderBackButton";
import { PmtilesPackageCard } from "../src/components/PmtilesPackageCard";
import { useDiagnosticsJsonShare } from "../src/diagnostics/useDiagnosticsJsonShare";
import { usePmtilesPackageReady } from "../src/storage/usePmtilesPackageReady";

export default function AdvancedScreen() {
  const navigation = useNavigation();
  const { refresh, cardStatus } = usePmtilesPackageReady();
  const {
    busy: exportingDiagnostics,
    error: exportDiagnosticsError,
    share: shareErrorLog,
  } = useDiagnosticsJsonShare();

  useEffect(() => {
    navigation.setOptions({
      title: "Advanced",
      headerLeft: () => <HeaderBackButton />,
    });
  }, [navigation]);

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
      <PmtilesPackageCard status={cardStatus} onImportSuccess={refresh} />
      <View className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <Text className="text-base font-semibold text-neutral-900">Diagnostics</Text>
        <Text className="mt-2 text-xs text-neutral-500">
          Logs JavaScript and React errors only (not native crashes).
        </Text>
        <Pressable
          className="mt-3 self-start rounded-md border border-neutral-300 bg-white px-4 py-2"
          disabled={exportingDiagnostics}
          onPress={() => {
            void shareErrorLog();
          }}
        >
          <Text className="font-semibold text-neutral-800">
            {exportingDiagnostics ? "Preparing export..." : "Export JS error log (JSON)"}
          </Text>
        </Pressable>
        {exportDiagnosticsError ? (
          <Text className="mt-2 text-sm text-red-700">{exportDiagnosticsError}</Text>
        ) : null}
      </View>
      <View className="mt-8">
        <Pressable
          className="self-start rounded-md bg-blue-600 px-4 py-3"
          onPress={() => {
            Alert.alert("Import Journey", "This feature is not available yet.");
          }}
        >
          <Text className="text-center font-semibold text-white">Import Journey</Text>
        </Pressable>
      </View>
      </ScrollView>
    </View>
  );
}
