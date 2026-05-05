export type JourneyImportFeedback = {
  complete: boolean;
  skippedRowCount: number;
  missingAssetCount: number;
};

let pending: JourneyImportFeedback | null = null;

export function setJourneyImportFeedback(feedback: JourneyImportFeedback): void {
  pending = feedback;
}

export function takeJourneyImportFeedback(): JourneyImportFeedback | null {
  const value = pending;
  pending = null;
  return value;
}
