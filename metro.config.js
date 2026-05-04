const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { withSentryConfig } = require("@sentry/react-native/metro");

const baseConfig = getDefaultConfig(__dirname);
const nativeWindConfig = withNativeWind(baseConfig, { input: "./global.css" });
nativeWindConfig.resolver.unstable_enablePackageExports = false;

// Sentry wraps last: hooks the Metro serializer to emit source maps so JS
// stacks de-symbolicate in Sentry. Must come after NativeWind to preserve
// NativeWind's serializer customisations.
module.exports = withSentryConfig(nativeWindConfig);
