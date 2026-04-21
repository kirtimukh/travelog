import type { JourneyStatus } from "../../db/schema";

export function getJourneyActionLabel(status: JourneyStatus | ""): string | null {
  if (status === "scheduled") {
    return "Start";
  }
  if (status === "ongoing") {
    return "Pause";
  }
  if (status === "paused") {
    return "Continue";
  }
  return null;
}

export function canEditInDetails(status: JourneyStatus | ""): boolean {
  return status !== "ongoing";
}
