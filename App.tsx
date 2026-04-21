import "./global.css";

import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { openAppDatabase } from "./src/db/client";
import { getAppStorage } from "./src/storage/mmkv";

export default function App() {
  const [status, setStatus] = useState<string>("Checking native modules…");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const lines: string[] = [];

      try {
        await openAppDatabase();
        lines.push("SQLite: OK (opened + PRAGMA user_version read)");
      } catch (e) {
        lines.push(
          `SQLite: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      try {
        const storage = getAppStorage();
        const ping = Date.now().toString();
        storage.set("__dev_ping", ping);
        const read = storage.getString("__dev_ping");
        lines.push(`MMKV: OK (ping=${read ?? "—"})`);
      } catch (e) {
        lines.push(
          `MMKV: ${e instanceof Error ? e.message : String(e)} — use a dev build (Expo Go has no MMKV native module).`,
        );
      }

      if (!cancelled) {
        setStatus(lines.join("\n\n"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View className="flex-1 bg-white pt-12">
      <ScrollView className="flex-1 px-6">
        <Text className="text-xl font-bold text-blue-600">
          MapMyTrip scaffold
        </Text>
        <Text className="mt-4 font-mono text-sm text-neutral-800">{status}</Text>
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}
