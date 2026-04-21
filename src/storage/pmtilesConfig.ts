import { getAppStorage } from "./mmkv";

const PMTILES_CONFIG_KEY = "pmtilesConfig.v1";
export const REQUIRED_PMTILES_FILENAME = "india-ne.pmtiles";

export type PmtilesConfig = {
  pmtilesPath: string;
  pmtilesFileName: string;
  pmtilesSize: number;
  pmtilesValidatedAt: number;
  pmtilesHash?: string;
};

export function getPmtilesConfig(): PmtilesConfig | null {
  try {
    const raw = getAppStorage().getString(PMTILES_CONFIG_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PmtilesConfig>;
    if (
      !parsed ||
      typeof parsed.pmtilesPath !== "string" ||
      typeof parsed.pmtilesFileName !== "string" ||
      typeof parsed.pmtilesSize !== "number" ||
      typeof parsed.pmtilesValidatedAt !== "number"
    ) {
      return null;
    }
    return {
      pmtilesPath: parsed.pmtilesPath,
      pmtilesFileName: parsed.pmtilesFileName,
      pmtilesSize: parsed.pmtilesSize,
      pmtilesValidatedAt: parsed.pmtilesValidatedAt,
      pmtilesHash:
        typeof parsed.pmtilesHash === "string" ? parsed.pmtilesHash : undefined,
    };
  } catch {
    return null;
  }
}

export function setPmtilesConfig(config: PmtilesConfig): void {
  getAppStorage().set(PMTILES_CONFIG_KEY, JSON.stringify(config));
}

export function clearPmtilesConfig(): void {
  getAppStorage().remove(PMTILES_CONFIG_KEY);
}
