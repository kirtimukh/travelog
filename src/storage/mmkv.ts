import { createMMKV, type MMKV } from "react-native-mmkv";

let instance: MMKV | null = null;

/** Lazily creates MMKV so the module can load before first use (dev client only; not Expo Go). */
export function getAppStorage(): MMKV {
  if (!instance) {
    instance = createMMKV({ id: "mapmytrip" });
  }
  return instance;
}
