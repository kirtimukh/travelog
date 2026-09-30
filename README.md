# Travelog (mobile)

Travelog (formerly **MapMyTrip**) is an Expo / React Native app for recording travel journeys: GPS track logging, voice & text notes, photos, weather, and an offline-capable map with a replay ("playback") of what happened.

## Stack

- **Expo 55 / React Native 0.83**, `expo-router` for navigation
- **MapLibre** (`@maplibre/maplibre-react-native`) for the map basemap
- **expo-sqlite** for journey data (versioned migrations), **react-native-mmkv** for small key/value state
- **NativeWind / Tailwind** for styling
- **Sentry** for crash reporting (journey status changes are also logged)
- `expo-task-manager` + `expo-location` for background location tracking
- Jest tests: `npm test` · Typecheck: `npx tsc --noEmit`

## Branches

| Branch | Basemap |
|---|---|
| [`main`](https://github.com/ubfoundry/Anini) | **Offline.** User uploads a static `.pmtiles` file; optional Google Weather integration |
| `may23` | **Online.** Connects to the mapserver/tiles produced by [kirtimukh/making-maps](https://github.com/kirtimukh/making-maps) |

### `main` — offline map + weather

- First launch is gated: you must upload a `.pmtiles` file. It is copied into app-owned storage and validated; if missing/corrupt, map routes are blocked until re-upload.
- GeoTIFF/vector pipelines generate the pmtiles; see the sibling repos in this workspace.
- **Google Weather** (optional): set `EXPO_PUBLIC_GOOGLE_WEATHER_API_KEY` in `.env`. Current conditions are fetched at the latest `WatchPosition` fix (so the fetch isn't slow) and must be **manually saved** — they appear as a weather card in the journey's notes feed.
- Android emulator preload helper:

  ```bash
  ./scripts/preload-pmtiles-android.sh                    # default demo file
  ./scripts/preload-pmtiles-android.sh /abs/path/map.pmtiles
  ```

  Pushes to `/sdcard/Download/`, then pick it in the app's upload dialog.

### `may23` — online map (making-maps)

- Removes the `.pmtiles` upload gate and the weather module entirely (weather DB migrations v7–v8 become no-ops so existing installs aren't broken).
- The basemap is now **multi-region dynamic tiles**: a bundled `assets/catalog/catalog.json` lists per-region PMTiles + metadata + bounds served from S3. The app picks whichever regions intersect the current viewport (`src/map/catalog.ts`, `src/storage/mapCatalog.ts`).
- Tile payloads are produced by the [making-maps](https://github.com/kirtimukh/making-maps) mapserver pipeline (currently `asia-india-southern-zone` is hardcoded for testing).

## Running

```bash
npm install
npx expo run:ios     # or: npx expo run:android   (dev client)
npx expo start --dev-client
```

## Usage

Screens (expo-router routes in `app/`):

- **Home (`app/index.tsx`)** — create a journey with a name + description; shows a PMTiles package card (so you can upload/replace the map); header menu with History and Advanced. If an ongoing journey exists, it is surfaced here (`useOngoingJourneyCandidate`) so you can jump straight back to it.
- **Journeys list (`app/journeys.tsx`)** — history of all recorded journeys.
- **Live journey (`app/journey/[id].tsx`)** — the recording screen.
- **Journey details (`app/journey/details/[id].tsx`)** — replay/stats/export for a past journey.
- **Advanced (`app/advanced.tsx`)** — PMTiles card, journey import (ZIP), misc settings.

Typical flow:

1. **Create a journey** on Home. It starts as `scheduled`.
2. **Upload a map** (`main` branch) if the PMTiles card isn't green yet — the app blocks map routes until a valid `.pmtiles` package is in place. (`may23` branch skips this; tiles stream from the catalog.)
3. **Start tracking** from the live screen (`scheduled → ongoing`). The status guide:
   - `scheduled`: map auto-centers on your location so you can confirm you're in the map's coverage before starting.
   - `ongoing`: foreground (optionally background) tracking writes `location_points` to SQLite continuously.
   - `pause` / `resume`: toggles recording; paused spans are excluded from playback and measured distance.
   - `complete` / `abandon`: both need a **two-step destructive confirmation**.
4. **Attach media live**: voice notes (record/rerecord/playback with elapsed time), text notes, photos (thumbnails + EXIF). On `main` with weather enabled, capture current conditions with `WatchPosition` and **save them manually** — they appear as a "Weather" card in the notes feed.
5. **Replay on details**: play back the track; event cards surface transiently (~3s) alongside the moving marker. Shows journey duration, recorded distance, and pause windows.
6. **Export / Import**: from details, export the journey as a ZIP (JSON + media) to Documents; re-import later from **Advanced → Import Journey**.

## Journey data

- Statuses `scheduled → ongoing ⇄ paused → completed / abandoned`, with locations tracked over time; media (voice/text notes, photos with EXIF + thumbnails) attach to it.
- SQLite via `expo-sqlite` with versioned migrations (`src/db/migrations.ts`); the weather module's migrations were kept as no-ops on `may23` so existing installs migrate cleanly.
- **ZIP export/import**: a journey (incl. JSON + media) can be exported to Documents and re-imported via **Advanced → Import Journey**.

## How the app evolved

Read from the commit history across both branches:

**1. Scaffold & first field test (Apr 21, 2026).** Expo scaffold with SQLite schema, tests, offline tiles. Immediately built the core loop: foreground GPS tracking, journey + journey-details screens, shared header, gesture-handler, scrollable screens.

**2. Recording features (Apr 22–23).** Map controls, replay screen, and an iterative voice recorder ("Voice recording enhancements - not-bug-free" → "refactors" → "Voice recorder working"). Then a feature-heavy day: photos with EXIF + thumbnails, media editing, Google Weather API, replay controls, pause-aware playback, journey/recorded duration & distance fields, and the two-step "end journey" confirmation. Weather capture was made slow-but-simple via `WatchPosition`, and conditions are saved manually rather than automatically.

**3. Polish, rename, resilience (May 3–5).** Renamed MapMyTrip → **Travelog**. Map centering/initial-position fixes, auto-center in scheduled state. Extracted shared building blocks (two-step destructive confirmation, ongoing-journey candidate hook, artifacts feed & modals, scheduled-map fallback). Android fixes (MapLibre remount on resume-from-background). Then the data layer grew up: journey ZIP export to Documents (JSON + media), import back into the app, an Advanced screen hosting it, and **Sentry** crash reporting.

**4. Stabilization (May 9–12).** App icon, package name, on-open race-condition fix, Sentry logging on journey status changes. Also a deadline pressure marker: "App times out on May-09" — a release gate for that date.

**5. Branch `may23` — flip to online maps (May 23–Jun 6).** A separate line of development:
- **Weather removed entirely** — UI, module, and its DB migrations turned into no-ops (v7–v8) so existing installs migrate cleanly. Docs cleaned.
- **Static `.pmtiles` upload dropped**, replaced by a **multi-region dynamic tile catalog**: a bundled `assets/catalog/catalog.json` lists per-region PMTiles served from S3, and the app selects whichever regions intersect the viewport (bounds + minZoom matching in `src/map/catalog.ts` / `src/storage/mapCatalog.ts`).
- Tiles are produced by the [making-maps](https://github.com/kirtimukh/making-maps) mapserver pipeline; `asia-india-southern-zone` is hardcoded for testing.
- Work is ongoing ("temp" is the latest commit).

In short: the app grew from a scaffold → a working offline journey recorder with media & weather → hardened with export/import and Sentry → then forked into an online, server-fed map variant with weather stripped out.
