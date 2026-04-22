const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// Expo: abi splits';

/**
 * Enables Gradle per-ABI APK splits for release/sideload builds.
 * Idempotent across repeated `expo prebuild`.
 */
function withAndroidAbiSplits(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.contents.includes(MARKER)) {
      return modConfig;
    }

    modConfig.modResults.contents = modConfig.modResults.contents.replace(
      /android\s*\{/,
      `android {
    ${MARKER}
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a"
            universalApk false
        }
    }`
    );

    return modConfig;
  });
}

module.exports = withAndroidAbiSplits;
