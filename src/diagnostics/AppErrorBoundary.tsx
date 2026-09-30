import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import * as Sentry from "@sentry/react-native";

import { appendErrorLogEntry } from "./errorLogStore";
import { getLastRoute } from "./routeContext";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void appendErrorLogEntry({
      ts: new Date().toISOString(),
      kind: "react",
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
      route: getLastRoute(),
    });

    if (!__DEV__) {
      Sentry.captureException(error, {
        contexts: {
          react: { componentStack: info.componentStack ?? "" },
        },
        extra: { route: getLastRoute() },
      });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text style={{ fontSize: 16, textAlign: "center" }}>
            Something went wrong.
          </Text>
          <Pressable
            style={{
              marginTop: 16,
              borderRadius: 6,
              backgroundColor: "#262626",
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
            onPress={() => {
              this.setState({ error: null });
            }}
          >
            <Text style={{ fontWeight: "600", color: "#fff" }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
