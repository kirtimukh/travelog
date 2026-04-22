import { DefaultTheme, type Theme } from "@react-navigation/native";
import { Platform } from "react-native";

/**
 * React Navigation's default Android fonts use `sans-serif-medium`, which React Native
 * can resolve as a missing asset (Typeface: Failed to read font contents). Use generic
 * `sans-serif` with explicit weights instead.
 */
export const appNavigationTheme: Theme =
  Platform.OS === "android"
    ? {
        ...DefaultTheme,
        fonts: {
          regular: { fontFamily: "sans-serif", fontWeight: "400" },
          medium: { fontFamily: "sans-serif", fontWeight: "500" },
          bold: { fontFamily: "sans-serif", fontWeight: "600" },
          heavy: { fontFamily: "sans-serif", fontWeight: "700" },
        },
      }
    : DefaultTheme;
