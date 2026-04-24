export type ErrorLogKind = "uncaught_js" | "react" | "promise" | "manual";

/** One JSON object per line in `app-errors.jsonl`. */
export type ErrorLogEntry = {
  ts: string;
  kind: ErrorLogKind;
  /** Exception constructor name or synthetic label. */
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  isFatal?: boolean;
  route?: string;
  /** Non-Error rejection payload, best-effort JSON-safe. */
  extra?: Record<string, unknown>;
};
