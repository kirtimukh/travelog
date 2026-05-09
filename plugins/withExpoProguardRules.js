const { withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

const MARKER = '-keep class expo.modules.**';

const EXPO_KEEP_RULES = `
# Expo modules - loaded via Class.forName() reflection at runtime; R8 cannot
# trace these statically so they must be kept explicitly.
-keep class expo.modules.** { *; }
-keep interface expo.modules.** { *; }
-keepnames class expo.modules.** { *; }
`;

/**
 * Merges Expo module ProGuard keep rules into the generated proguard-rules.pro.
 * Idempotent across repeated `expo prebuild`.
 */
function withExpoProguardRules(config) {
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const proguardPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );

      let contents = fs.readFileSync(proguardPath, 'utf8');

      if (!contents.includes(MARKER)) {
        contents += EXPO_KEEP_RULES;
        fs.writeFileSync(proguardPath, contents, 'utf8');
      }

      return modConfig;
    },
  ]);
}

module.exports = withExpoProguardRules;
