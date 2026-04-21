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

## Step 3: PMTiles upload + Android emulator preload

- First launch is gated: app requires uploading `india-ne.pmtiles`.
- The file is copied into app-owned documents storage and validated.
- If missing/corrupt later, map routes are blocked until re-upload.

### Preload `india-ne.pmtiles` into Android emulator

From `mobile/`:

```bash
./scripts/preload-pmtiles-android.sh
```

Optional custom source file:

```bash
./scripts/preload-pmtiles-android.sh /absolute/path/to/india-ne.pmtiles
```

The script pushes the file to `/sdcard/Download/india-ne.pmtiles`.  
Then, in the app, tap upload and select that file from Downloads.
