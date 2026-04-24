import { appendErrorLogEntry } from "./errorLogStore";
import type { ErrorLogEntry } from "./errorLogTypes";
import { getLastRoute } from "./routeContext";

let installed = false;

function baseEntry(): Pick<ErrorLogEntry, "ts" | "route"> {
  return {
    ts: new Date().toISOString(),
    route: getLastRoute(),
  };
}

function normalizePromiseRejection(rejection: unknown): {
  name: string;
  message: string;
  stack?: string;
  extra?: Record<string, unknown>;
} {
  if (rejection === undefined) {
    return { name: "undefined", message: "" };
  }
  if (rejection instanceof Error) {
    return {
      name: rejection.name,
      message: rejection.message,
      stack: rejection.stack,
    };
  }
  if (
    typeof rejection === "object" &&
    rejection !== null &&
    Object.prototype.toString.call(rejection) === "[object Error]"
  ) {
    const e = rejection as Error;
    return {
      name: typeof e.name === "string" ? e.name : "Error",
      message: typeof e.message === "string" ? e.message : String(e),
      stack: typeof e.stack === "string" ? e.stack : undefined,
    };
  }
  if (typeof rejection === "string") {
    return { name: "string", message: rejection };
  }
  try {
    return {
      name: typeof rejection,
      message: JSON.stringify(rejection),
    };
  } catch {
    return { name: typeof rejection, message: String(rejection) };
  }
}

export function installErrorLogging(): void {
  if (installed) {
    return;
  }

  const EU = (
    globalThis as typeof globalThis & {
      ErrorUtils?: {
        getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
        setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
      };
    }
  ).ErrorUtils;
  if (!EU) {
    return;
  }
  installed = true;

  const previousHandler = EU.getGlobalHandler();
  EU.setGlobalHandler((error: Error, isFatal?: boolean) => {
    const e = error instanceof Error ? error : new Error(String(error));
    void appendErrorLogEntry({
      ...baseEntry(),
      kind: "uncaught_js",
      name: e.name,
      message: e.message,
      stack: e.stack,
      isFatal: isFatal === true,
    });
    previousHandler(error, isFatal);
  });

  if (!__DEV__) {
    // RN only enables `promise/setimmediate/rejection-tracking` in __DEV__ (see Libraries/Promise.js).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rejectionTracking = require("promise/setimmediate/rejection-tracking") as {
      enable(options: {
        allRejections?: boolean;
        onUnhandled: (id: number, rejection: unknown) => void;
        onHandled: (id: number) => void;
      }): void;
    };
    rejectionTracking.enable({
      allRejections: true,
      onUnhandled: (_id, rejection) => {
        const n = normalizePromiseRejection(rejection);
        void appendErrorLogEntry({
          ...baseEntry(),
          kind: "promise",
          name: n.name,
          message: n.message,
          stack: n.stack,
          extra: n.extra,
        });
      },
      onHandled: () => {},
    });
  }
}

installErrorLogging();
