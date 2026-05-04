const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

// Expo + Sentry: use getSentryExpoConfig so debug IDs and release injection use
// unstable_beforeAssetSerializationPlugins with Expo's serializer (avoids wrapping
// issues from withSentryConfig + getDefaultConfig).
const sentryConfig = getSentryExpoConfig(__dirname);
const config = withNativeWind(sentryConfig, { input: "./global.css" });
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
