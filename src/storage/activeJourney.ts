import { getAppStorage } from "./mmkv";

export const ACTIVE_JOURNEY_ID_KEY = "activeJourneyId";

export function getActiveJourneyId(): number | null {
  try {
    const s = getAppStorage().getString(ACTIVE_JOURNEY_ID_KEY);
    if (s == null || s === "") {
      return null;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setActiveJourneyId(id: number | null): void {
  const storage = getAppStorage();
  if (id == null) {
    storage.remove(ACTIVE_JOURNEY_ID_KEY);
  } else {
    storage.set(ACTIVE_JOURNEY_ID_KEY, String(id));
  }
}

export function clearActiveJourneyId(): void {
  setActiveJourneyId(null);
}
