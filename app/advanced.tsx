import { router, useNavigation } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { HeaderBackButton } from "../src/components/HeaderBackButton";
import { useDiagnosticsJsonShare } from "../src/diagnostics/useDiagnosticsJsonShare";
import { useJourneyImport } from "../src/features/journey/hooks/useJourneyImport";
import { reloadBundledMapCatalog } from "../src/storage/mapCatalog";
import { useMapCatalogReady } from "../src/storage/useMapCatalogReady";

export default function AdvancedScreen() {
  const navigation = useNavigation();
  const [importError, setImportError] = useState<string | null>(null);

  const onImportSuccess = useCallback(({ journeyId }: { journeyId: number }) => {
    router.navigate(`/journey/details/${journeyId}`);
  }, []);

  const journeyImport = useJourneyImport({
    setScreenError: setImportError,
    onImportSuccess,
  });
  const { cardStatus: catalogStatus, regionCount, refresh: refreshCatalog } =
    useMapCatalogReady();
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
        <View className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <Text className="text-base font-semibold text-neutral-900">Map basemap</Text>
          <Text className="mt-2 text-sm text-neutral-700">{catalogStatus}</Text>
          <Text className="mt-1 text-xs text-neutral-500">
            {regionCount > 0
              ? `${regionCount} bundled regions ship with the app.`
              : "No bundled regions loaded."}
          </Text>
          <Text className="mt-3 text-sm text-neutral-600">
            Basemap tiles load from S3 for whichever catalog regions intersect the map
            viewport. Network is required for tile fetches.
          </Text>
          <Text className="mt-2 text-xs text-neutral-500">
            After updating tileserver/catalog.json, run npm run sync-catalog and bump
            BUNDLED_CATALOG_REVISION before release.
          </Text>
          <Pressable
            className="mt-3 self-start rounded-md border border-neutral-300 bg-white px-4 py-2"
            onPress={() => {
              reloadBundledMapCatalog();
              refreshCatalog();
            }}
          >
            <Text className="font-semibold text-neutral-800">Reload bundled catalog</Text>
          </Pressable>
        </View>
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
          <Text className="text-sm text-neutral-600">
            Import a Travelog export (ZIP with journey.json). Android only for now.
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Pressable
              className="rounded-md bg-blue-600 px-4 py-3 opacity-100 disabled:opacity-50"
              disabled={
                Platform.OS !== "android" ||
                journeyImport.importBusy ||
                journeyImport.requestImportJourney == null
              }
              onPress={() => {
                void journeyImport.requestImportJourney?.();
              }}
            >
              <Text className="text-center font-semibold text-white">
                {journeyImport.importBusy ? "Importing…" : "Import Journey"}
              </Text>
            </Pressable>
            {Platform.OS === "android" && journeyImport.importBusy ? (
              <Pressable
                className="rounded-md border border-neutral-300 bg-white px-4 py-3"
                onPress={() => {
                  journeyImport.cancelImportJourney?.();
                }}
              >
                <Text className="font-semibold text-neutral-800">Cancel import</Text>
              </Pressable>
            ) : null}
          </View>
          {importError ? (
            <Text className="mt-2 text-sm text-red-700">{importError}</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
