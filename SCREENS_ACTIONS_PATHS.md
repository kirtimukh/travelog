# Travelog — Screens, Actions & Conditional Paths

This document maps every screen, user action, modal, and conditional branch in the Travelog mobile app. Derived from source code as of May 2026.

---

## Route map

| Route                     | File                            | Screen name              |
| ------------------------- | ------------------------------- | ------------------------ |
| `/`                       | `app/index.tsx`                 | Home                     |
| `/journeys`               | `app/journeys.tsx`              | Journey History          |
| `/advanced`               | `app/advanced.tsx`              | Advanced                 |
| `/journey/[id]`           | `app/journey/[id].tsx`          | Live Journey             |
| `/journey/details/[id]`   | `app/journey/details/[id].tsx`  | Journey Details (Replay) |

All screens live in a single flat `<Stack>` navigator (Expo Router). There are no tabs, drawers, or nested stacks.

---

## Global conditional gates

These conditions apply across the entire app before any screen-specific logic runs.

### 1. App expiry (`_layout.tsx`)

| Condition | Result |
| --- | --- |
| `Date.now() >= APP_EXPIRES_AT` (May 15 2026 00:00 IST) | Full app replaced with static "Contact the developer" screen |
| Before expiry | Normal app renders |

### 2. PMTiles validity on app resume (`_layout.tsx`)

On every `AppState` change to `"active"`, the root layout checks `hasValidPmtilesPackage()`.

| Condition | Result |
| --- | --- |
| PMTiles valid OR user not on `/journey/*` | No-op |
| PMTiles invalid AND user is on `/journey/*` | Force-redirect to `/` (Home) via `router.replace("/")` |

### 3. Header menu (all screens)

The `AppHeaderMenu` hamburger is mounted on every screen's header. Its items are conditionally shown:

| Menu item | Shown when |
| --- | --- |
| Home | `showHome` prop is true (all screens except Home) |
| History | `showHistory` prop is true (Home, Live Journey, Details) |
| Advanced | `showAdvanced` prop is true (Home only) |
| Ongoing | An ongoing/paused journey exists AND `hideOngoing` is false |
| Export Journey | On Details screen when export handlers are provided |
| End Journey | On Live Journey screen when `onEndJourney` is provided |
| Delete Journey | On Details screen when `onDeleteJourney` is provided |

---

## Screen 1: Home (`/`)

### Conditional rendering tree

```
Home Screen
├── PMTiles checking?
│   └── YES → "Checking map package..."
├── PMTiles NOT ready AND NOT checking?
│   ├── Show "Upload a .pmtiles file..." message
│   └── Show PmtilesPackageCard (import flow)
├── PMTiles ready?
│   ├── "Map package configured" + "Change map package…" link → /advanced
│   ├── "View all journeys" button → /journeys
│   ├── Candidate journey loading?
│   │   └── "Loading journey..."
│   ├── Candidate journey exists?
│   │   ├── Show journey card (name, status, description)
│   │   ├── Status = "scheduled" → button label: "Start Journey"
│   │   ├── Status = "ongoing" | "paused" → button label: "Continue Journey"
│   │   └── Tap → navigate to /journey/{id}
│   └── No candidate journey?
│       └── Show "New journey" form (name + description required)
```

### Candidate journey priority

The `getMainScreenJourneyCandidate` query returns at most one journey with priority: `ongoing` > `paused` > `scheduled`.

### Actions

| Action | Condition | Effect |
| --- | --- | --- |
| Tap "Start Journey" / "Continue Journey" | Candidate journey exists, PMTiles ready | Navigate to `/journey/{candidate.id}` |
| Submit "Create Journey" | Name and description non-empty, PMTiles ready | Create DB row, navigate to `/journey/{newId}` |
| Tap "View all journeys" | PMTiles ready | Navigate to `/journeys` |
| Tap "Change map package…" | PMTiles ready | Navigate to `/advanced` |
| Import PMTiles (via card) | PMTiles not ready | Triggers file picker, on success refreshes state |
| Header menu → History | Always | Navigate to `/journeys` |
| Header menu → Advanced | Always | Navigate to `/advanced` |
| Header menu → Ongoing | Ongoing journey exists | Navigate to `/journey/{ongoingId}` |

### Error states

| Error | Trigger |
| --- | --- |
| "Name and description are required." | Submit with empty fields |
| "Failed to create journey. Try again." | DB write failure |

---

## Screen 2: Journey History (`/journeys`)

### Filters

| Filter | Input | Behavior |
| --- | --- | --- |
| Name | Free text | Filters journeys by name substring |
| Status | Pill selector: all / scheduled / ongoing / paused / completed / abandoned | Filters by status |
| Date | Text input (YYYY-MM-DD) | Filters journeys whose time span covers that day |

### Conditional states

```
Journeys Screen
├── Invalid date entered?
│   └── Show "Enter date as YYYY-MM-DD." error, disable Apply
├── Loading?
│   └── "Applying filters..." (button disabled)
├── Error?
│   └── Show error message (e.g. "Failed to load journeys.")
├── No results?
│   └── "No journeys found."
└── Results exist?
    └── List of journey cards (name, status, start, end, description)
```

### Actions

| Action | Condition | Effect |
| --- | --- | --- |
| Tap journey card | Always | Navigate to `/journey/details/{journey.id}` |
| Tap "Apply filters" | Valid inputs, not loading | Re-query DB with current filters |
| Submit name/date field | On keyboard submit | Same as Apply filters |
| Header menu → Home | Always | Navigate to `/` |
| Header menu → Ongoing | Ongoing journey exists | Navigate to `/journey/{ongoingId}` |

---

## Screen 3: Advanced (`/advanced`)

### Layout

Three sections stacked vertically:

1. **PMTiles package card** — import/replace map file
2. **Diagnostics** — export JS error log
3. **Journey import** — import a Travelog ZIP export

### Conditional states

```
Advanced Screen
├── PMTiles card
│   ├── Checking → "Checking map package..."
│   ├── Ready → shows filename, allows re-import
│   └── Not ready → shows import prompt
├── Diagnostics
│   ├── Exporting? → "Preparing export..." (button disabled)
│   └── Export error? → show error text
└── Journey import
    ├── Platform != Android → import button disabled
    ├── Import busy? → "Importing…" + Cancel button shown
    └── Import error? → show error text
```

### Actions

| Action | Condition | Effect |
| --- | --- | --- |
| Import PMTiles | Always available | File picker → validate → save config |
| Export JS error log | Not busy | Collects error logs → share sheet |
| Import Journey | Android only, not busy | File picker → parse ZIP → create journey in DB → navigate to `/journey/details/{id}` |
| Cancel import | Import busy | Cancels in-progress import |

---

## Screen 4: Live Journey (`/journey/[id]`)

This is the primary active journey screen with the richest conditional logic.

### Status-driven primary action

| Journey status | Action button label | Hold-to-confirm modal | DB transition |
| --- | --- | --- | --- |
| `scheduled` | "Start" | "Start journey?" — requires location permission | `scheduled` → `ongoing` |
| `ongoing` | "Pause" | "Pause journey?" | `ongoing` → `paused` |
| `paused` | "Continue" | "Continue journey?" | `paused` → `ongoing` |
| `completed` | *(no button)* | — | — |

### Location permission gate (on Start)

When starting a `scheduled` journey:
1. Check if location permission already granted
2. If not, request permission via `requestMapPermission()`
3. If denied → error: "Location permission is required to start and map this journey."
4. If granted → transition to `ongoing`, record first GPS point

### Conditional rendering tree

```
Live Journey Screen
├── Journey name + status
├── Error? → show error text
├── Needs background location settings?
│   └── "Open location settings" button → Linking.openSettings()
├── Map panel
│   ├── Has points → show path
│   ├── Status = "scheduled" + no points → show current location marker (scheduled variant)
│   ├── No location permission → "Grant location" prompt
│   └── Has fallback coordinates → show fallback marker
├── Primary action button (status-dependent, see table above)
│   └── Tap → opens JourneyActionConfirmModal (hold 2s to confirm)
├── Artifact action buttons (Weather, Media, Text Note, Voice Note)
│   ├── Rerecord session active? → Weather, Text, Voice buttons visually disabled/dimmed
│   └── Otherwise → all enabled
├── Artifacts feed (notes, media, weather, pause windows)
├── Rerecord overlay bar (when rerecord session active)
│   └── "Stop and save" button
├── Text note modal (when textNoteModalVisible)
├── Voice note modal (when voiceNoteModalVisible)
├── Add media modal (when mediaEditFlow.addModal.visible)
└── Editor modals (note edit, media edit, weather)
```

### End journey flow (via header menu)

1. User taps "End Journey" in hamburger menu
2. **First alert**: "End journey?" / "This will mark {name} as complete..."
   - Cancel → dismiss
   - Continue → proceeds to step 3
3. **Second alert**: "Final confirmation" / "Ending this journey cannot be undone."
   - Cancel → dismiss
   - "End journey" → marks as `completed`, navigates to `/journey/details/{id}`

### Artifact actions on Live Journey

| Action | Opens | Condition |
| --- | --- | --- |
| ☁️ Weather | JourneyWeatherModal (capture mode) | Always available |
| 📷 Media | JourneyAddMediaModal | Always available |
| T Text note | JourneyAddNoteModal (text mode) | Disabled during rerecord |
| 🔴 Voice note | JourneyAddNoteModal (voice mode) | Disabled during rerecord |
| Tap note in feed | JourneyNoteEditModal | Always |
| Tap media in feed | JourneyMediaEditModal | Always |
| Tap weather in feed | JourneyWeatherModal (view mode) | Always |

---

## Screen 5: Journey Details / Replay (`/journey/details/[id]`)

### Editing gate

| Journey status | Editable? |
| --- | --- |
| `ongoing` | NO — "Editing notes/media is disabled while journey is ongoing." |
| All other statuses | YES |

### Export gate

| Condition | Export available? |
| --- | --- |
| `status === "scheduled"` | NO (disabled) |
| Note or media edit busy | NO (disabled) |
| Delete busy | NO (disabled) |
| Export already busy | NO (disabled) |
| Otherwise | YES |

### Delete gate

| Condition | Delete available? |
| --- | --- |
| Note or media edit busy | NO (disabled) |
| Delete already busy | NO (disabled) |
| Export busy | NO (disabled) |
| Otherwise | YES — triggers two-step destructive confirm |

### Conditional rendering tree

```
Journey Details Screen
├── Journey name + status
├── Screen error? → show error text
├── Export warning? → dismissable amber banner
├── Import complete feedback? → dismissable green banner
│   └── May include skip summary (skipped rows, missing assets)
├── Map section (replay path + replay point)
│   ├── No location permission → "Grant location" prompt
│   └── Has permission → shows replay path/point
├── Replay stats card
│   └── Shows replay timestamp, duration, distance, speed, heading
├── Replay toolbar
│   └── Play / Pause / Reset controls (not available for scheduled journeys)
├── Editing disabled message?
│   └── Status = "ongoing" → "Editing notes/media is disabled..."
├── Artifacts feed (notes, media, weather, pause windows)
│   ├── Editable → tap to edit
│   └── Not editable → view only
└── Editor modals (note edit, media edit, weather view)
    └── Re-record audio on Details screen → error message:
        "Re-recording is only available on the live journey screen."
```

### Actions

| Action | Condition | Effect |
| --- | --- | --- |
| Replay / Pause / Reset | Journey not scheduled, has points | Controls map replay animation |
| Edit note (text) | Editable (not ongoing) | Opens JourneyNoteEditModal → save/delete |
| Edit note (voice) | Editable (not ongoing) | Opens JourneyNoteEditModal → play/delete (no re-record) |
| Edit media | Editable (not ongoing) | Opens JourneyMediaEditModal → edit caption, timestamp, lat/lng, delete |
| View weather | Always | Opens JourneyWeatherModal (view mode) → delete if editable |
| Header → Export | See export gate | Opens export picker (Save to device / Share) |
| Header → Delete | See delete gate | Two-step destructive confirm → deletes journey + files → navigates to `/journeys` |
| Header → Home | Always | Navigate to `/` |
| Header → History | Always | Navigate to `/journeys` |
| Header → Ongoing | Ongoing journey exists, not this one | Navigate to `/journey/{ongoingId}` |

---

## Modal inventory

### JourneyActionConfirmModal

**Trigger**: Tap primary action button on Live Journey screen.
**UX**: Hold-to-confirm (2 seconds) with progress bar.

| `actionKind` | Title | Message |
| --- | --- | --- |
| `start` | "Start journey?" | "Location will be used to map your route. Hold the button below for 3 seconds to confirm." |
| `pause` | "Pause journey?" | "Recording will pause until you continue. Hold for 3 seconds to confirm." |
| `continue` | "Continue journey?" | "Recording will resume. Hold for 3 seconds to confirm." |

### JourneyAddNoteModal (via JourneyAddNoteController)

**Trigger**: Tap T (text) or 🔴 (voice) button on Live Journey.
**Lifecycle**: Controller is conditionally mounted per session for clean recording state.

**Text mode flow**:
```
Open → Type text → Save → (DB write) → Close + refresh feed
```

**Voice mode flow**:
```
Open → "Start voice recording"
  → Recording active → "Stop recording" → produces draft
    → Draft ready → Play preview / "Save" / "Discard"
      → Save → (DB write, copy file) → Close + refresh feed
      → Discard → (unlink temp file) → back to idle
```

**Cleanup**: On unmount, any active recorder is interrupted and any draft file is unlinked.

### JourneyAddMediaModal

**Trigger**: Tap 📷 button on Live Journey.

```
Open → "Pick image" → image picker → preview shown
  → Optionally add caption
  → "Save media" (disabled until image picked) → (copy to app docs, DB write) → Close
```

### JourneyNoteEditModal

**Trigger**: Tap a note in the artifacts feed.

**Text note**:
```
Edit text → Save / Delete
```

**Voice note (with audio file)**:
```
Play / Pause audio → Delete
```

**Voice note (missing audio file)**:
```
Delete / Re-record audio
  → Live Journey: starts rerecord session (RerecordOverlayBar)
  → Details screen: shows error "Re-recording is only available on the live journey screen."
```

### JourneyMediaEditModal

**Trigger**: Tap a media item in the artifacts feed (when editable).

```
Edit: caption, local datetime, epoch timestamp, latitude, longitude
Actions: Save / Delete image / Cancel
```

### JourneyWeatherModal

**Trigger**: Tap ☁️ on Live Journey, or tap weather card in feed.

Three modes with distinct UI:

| Mode | Shown when | UI |
| --- | --- | --- |
| `captureIdle` | Opened from ☁️ button, no preview yet | Quota info + "Get weather conditions" (or "Retry" if offline) |
| `capturePreview` | Weather fetched, not yet saved | Weather data card + "Save" / "Discard" |
| `viewExisting` | Opened from weather card in feed | Weather data card + "Delete" (if editable) |

**Conditional states within captureIdle**:

| Condition | UI |
| --- | --- |
| Offline | "Internet connection is required..." + "Retry" button |
| Online, within quota | "Get weather conditions" enabled |
| Online, quota exhausted | "Get weather conditions" disabled, quota label shown |

### RerecordOverlayBar

**Trigger**: User taps "Re-record audio" on a voice note from the Live Journey screen.

```
Shows at bottom of screen → recording elapsed time → "Stop and save"
  → Stops recording → saves new audio over existing note → bar dismissed
```

While active: Text note, Voice note, and Weather buttons are visually disabled.

### Export picker modal (in AppHeaderMenu)

**Trigger**: Tap "Export Journey" in header menu on Details screen.

```
"Save to device" → downloads ZIP to device storage
"Share…" → opens system share sheet with ZIP
"Cancel" → close
```

### Two-step destructive confirm alerts

Used for **End Journey** (Live screen) and **Delete Journey** (Details screen).

```
Alert 1: "{Action}?" + message
  → Cancel → dismiss
  → Continue →
    Alert 2: "Final confirmation" + irreversibility warning
      → Cancel → dismiss
      → "{Action}" → executes destructive operation
```

---

## Journey status lifecycle

```
   ┌────────────┐
   │  scheduled  │ (created on Home screen)
   └──────┬─────┘
          │ Start (hold-to-confirm + location permission)
          ▼
   ┌────────────┐         ┌────────────┐
   │   ongoing   │◄───────│   paused    │
   └──────┬─────┘ Continue└──────▲─────┘
          │                       │
          │ Pause                 │
          ├───────────────────────┘
          │
          │ End Journey (two-step confirm)
          ▼
   ┌────────────┐
   │  completed  │
   └────────────┘
```

The `abandoned` status exists in the schema but has no UI trigger in the current codebase.

---

## Navigation flow summary

```
                    ┌──────────────────────┐
                    │      Home (/)         │
                    │                       │
                    │ PMTiles not ready:    │
                    │   → Import card       │
                    │ PMTiles ready:        │
                    │   → Candidate card OR │
                    │   → New journey form  │
                    └──────┬──┬──┬─────────┘
                           │  │  │
              ┌────────────┘  │  └────────────┐
              ▼               ▼               ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │  /journeys   │  │  /advanced   │  │ /journey/[id]│
   │  (History)   │  │  (Settings)  │  │ (Live)       │
   └──────┬───────┘  └──────────────┘  └──────┬───────┘
          │                                     │
          │  Tap journey card           End journey
          ▼                                     │
   ┌───────────────────┐                       │
   │ /journey/details/  │◄──────────────────────┘
   │        [id]        │
   │ (Replay + Edit)    │
   └────────────────────┘
```

---

## Background behaviors

| Behavior | Trigger | Effect |
| --- | --- | --- |
| Background location tracking | Journey status = `ongoing` | Foreground service with persistent notification; commits GPS points per sampling rules |
| Battery-aware accuracy | Battery < 10% | Switches to reduced accuracy; resumes high accuracy above 12% |
| Location cache subscription | App startup | Subscribes to AppState for current location cache updates |
| PMTiles re-validation | AppState → active | Checks file validity; force-redirects if invalid on journey screen |
| Splash screen | App startup | Shown until layout mounts, then hidden |
