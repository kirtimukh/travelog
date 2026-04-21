# MapMyTrip (mobile)

Expo app scaffold: NativeWind, `expo-sqlite`, `react-native-mmkv` (via `react-native-nitro-modules`), and `expo-dev-client`.

## Run (JavaScript / Metro)

```bash
cd mobile
npm install
npx expo start
```

- **Expo Go:** You can load the bundle for UI and **SQLite** checks. **MMKV is not included in Expo Go** — the app shows an error line for MMKV until you use a development build.

## Run with MMKV (development build)

MMKV requires native code. After installing dependencies:

```bash
cd mobile
npx expo run:ios
# or
npx expo run:android
```

Then start Metro with `npx expo start --dev-client` and open the dev client on the simulator or device.

## Checks

- **Typecheck:** `npx tsc --noEmit`
