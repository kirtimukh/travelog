
## Unique Visual States to Capture (~32 screenshots)

These are the truly distinct layouts/components across the entire app:

### Screens (7)

| # | State | What's unique |
|---|-------|---------------|
| S1 | Home — new journey form | Form fields, "Create Journey" button, "View all journeys" link |
| S2 | Home — candidate journey card | Card with name/status/description, "Continue Journey" button |
| S3 | Home — validation error | Error message: "Name and description are required." |
| S4 | Advanced | PMTiles card + Diagnostics + Journey import (3-section layout) |
| S5 | Journey History — empty | "No journeys found." + filter controls |
| S6 | Journey History — with results | Journey cards list + filters |
| S7 | Journey History — filter error | "Enter date as YYYY-MM-DD." + disabled Apply |

### Live Journey States (4)

| # | State | What's unique |
|---|-------|---------------|
| L1 | Live Journey — scheduled | Map + "Start" button + artifact buttons |
| L2 | Live Journey — ongoing | Map with path + "Pause" button + all artifact buttons enabled |
| L3 | Live Journey — paused | "Continue" button variant |
| L4 | Live Journey — re-record active | Overlay bar at bottom + dimmed artifact buttons |

### Journey Details (2)

| # | State | What's unique |
|---|-------|---------------|
| D1 | Details — completed | Map replay + stats card + replay toolbar + editable feed |
| D2 | Details — replay in progress | Replay marker moving on path (if visually distinct from D1) |

### Modals & Overlays (17)

| # | State | What's unique |
|---|-------|---------------|
| M1 | Hamburger menu (open) | Menu item list |
| M2 | Hold-to-confirm modal | Progress bar + hold button (one captures all 3 action types) |
| M3 | Two-step alert — first | "End/Delete journey?" prompt |
| M4 | Two-step alert — second | "Final confirmation" irreversibility warning |
| M5 | Weather — captureIdle | Quota info + "Get weather conditions" button |
| M6 | Weather — capturePreview | Weather data card + Save / Discard |
| M7 | Weather — viewExisting | Weather data card + Delete button |
| M8 | Text note — add modal | Empty text field + Save |
| M9 | Voice note — idle | "Start voice recording" button |
| M10 | Voice note — recording | Timer + "Stop recording" button |
| M11 | Voice note — draft preview | Play button + Save / Discard |
| M12 | Media — add (empty) | "Pick image" button, Save disabled |
| M13 | Media — add (image selected) | Image preview + caption field + Save enabled |
| M14 | Note edit — text | Editable text + Save / Delete |
| M15 | Note edit — voice | Play/Pause + Delete (+ Re-record if available) |
| M16 | Media edit modal | Caption, datetime, lat/lng fields + Save / Delete |
| M17 | Export picker | "Save to device" / "Share" / "Cancel" |

### Conditional / System (2)

| # | State | What's unique |
|---|-------|---------------|
| C1 | Location permission dialog | System permission prompt |
| C2 | Artifacts feed (scrolled) | Multiple card types visible: weather, text, voice, media, pause window |

**Total: ~32 unique screenshots**

---

## Minimal Execution Flow (~55 actions)

This is the shortest path that captures every unique state above, ordered to avoid unnecessary navigation.

### Phase 1 — Home + Static Screens (captures: S1, S3, M1, S4, S5, S7)

| Step | Action | Captures |
|------|--------|----------|
| 1 | Layout dump + screenshot of Home | **S1** — Home with form |
| 2 | Tap "Create Journey" with empty fields | |
| 3 | Screenshot | **S3** — validation error |
| 4 | Open hamburger menu | |
| 5 | Screenshot | **M1** — hamburger menu |
| 6 | Tap "Advanced" | |
| 7 | Screenshot | **S4** — Advanced screen |
| 8 | Hamburger → "Home" → hamburger → "History" | |
| 9 | Screenshot | **S5** — History empty |
| 10 | Type invalid date "abc" in date field | |
| 11 | Screenshot | **S7** — filter error |
| 12 | Clear date, hamburger → "Home" | |

### Phase 2 — Create & Start Journey (captures: L1, M2, C1, L2)

| Step | Action | Captures |
|------|--------|----------|
| 13 | Type "Screenshot Journey" in name, "Capturing screenshots" in description | |
| 14 | Tap "Create Journey" → navigates to Live | |
| 15 | Screenshot | **L1** — scheduled |
| 16 | Tap "Start" button | |
| 17 | Screenshot | **M2** — hold-to-confirm modal |
| 18 | Long-press confirm (~2.5s) | |
| 19 | Screenshot (if permission dialog appears) | **C1** — location permission |
| 20 | Grant permission | |
| 21 | Screenshot | **L2** — ongoing |

### Phase 3 — Add All Artifact Types (captures: M5–M13)

| Step | Action | Captures |
|------|--------|----------|
| 22 | Tap ☁️ Weather | |
| 23 | Screenshot | **M5** — weather captureIdle |
| 24 | Tap "Get weather conditions" | |
| 25 | Screenshot | **M6** — weather capturePreview |
| 26 | Tap "Save" | |
| 27 | Tap **T** Text | |
| 28 | Screenshot | **M8** — text add modal (empty) |
| 29 | Type "Test note aB3kFm9xPqR2wLz7NjY4cDe8HgT1VuI5oSXiKlJn" | |
| 30 | Tap "Save" | |
| 31 | Tap 🔴 Voice | |
| 32 | Screenshot | **M9** — voice idle |
| 33 | Tap "Start voice recording" | |
| 34 | Screenshot | **M10** — voice recording |
| 35 | Wait 5 seconds, tap "Stop recording" | |
| 36 | Screenshot | **M11** — voice draft preview |
| 37 | Tap "Save" | |
| 38 | Tap 📷 Media | |
| 39 | Screenshot | **M12** — media add (empty) |
| 40 | Tap "Pick image", select image | |
| 41 | Type "Test weather" in caption | |
| 42 | Screenshot | **M13** — media with preview + caption |
| 43 | Tap "Save media" | |

### Phase 4 — Feed + Edit Modals (captures: C2, M14–M16, M7)

| Step | Action | Captures |
|------|--------|----------|
| 44 | Scroll down to see full feed | |
| 45 | Screenshot | **C2** — feed with multiple card types |
| 46 | Tap text note in feed → screenshot | **M14** — text edit modal |
| 47 | Dismiss | |
| 48 | Tap voice note in feed → screenshot | **M15** — voice edit modal |
| 49 | Dismiss | |
| 50 | Tap media in feed → screenshot | **M16** — media edit modal |
| 51 | Dismiss | |
| 52 | Tap weather in feed → screenshot | **M7** — weather viewExisting |
| 53 | Dismiss | |

### Phase 5 — Re-record Overlay (captures: L4)

| Step | Action | Captures |
|------|--------|----------|
| 54 | Tap voice note in feed → tap "Re-record audio" | |
| 55 | Screenshot | **L4** — re-record overlay + disabled buttons |
| 56 | Wait 5 seconds → tap "Stop and save" | |

### Phase 6 — Pause + Home Candidate (captures: L3, S2)

| Step | Action | Captures |
|------|--------|----------|
| 57 | Tap "Pause" → long-press confirm | |
| 58 | Screenshot | **L3** — paused state |
| 59 | Hamburger → "Home" | |
| 60 | Screenshot | **S2** — Home with candidate card ("Continue Journey") |
| 61 | Tap "Continue Journey" → on Live, tap "Continue" → long-press confirm | Back to ongoing |

### Phase 7 — End Journey + Details (captures: M3, M4, D1, D2, M17)

| Step | Action | Captures |
|------|--------|----------|
| 62 | Hamburger → "End Journey" | |
| 63 | Screenshot | **M3** — first destructive alert |
| 64 | Tap "Continue" | |
| 65 | Screenshot | **M4** — second destructive alert |
| 66 | Tap "End journey" → redirects to Details | |
| 67 | Screenshot | **D1** — Details completed |
| 68 | Tap replay "Play" | |
| 69 | Screenshot | **D2** — replay in progress |
| 70 | Hamburger → "Export Journey" | |
| 71 | Screenshot | **M17** — export picker |
| 72 | Tap "Cancel" | |

### Phase 8 — History with Data (captures: S6)

| Step | Action | Captures |
|------|--------|----------|
| 73 | Hamburger → "History" | |
| 74 | Screenshot | **S6** — History with journey cards |

---

## Comparison

| | Original Plan | Minimal Plan |
|---|---|---|
| Total steps | ~178 | ~74 |
| Screenshots | ~120 | ~32 |
| Unique visual states covered | same | same |
| Redundant filter/status combos | 8+ | 0 |
| Duplicate modal screenshots | many | 0 |

The 32 screenshots cover every distinct screen layout, modal variant, component state, and overlay in the app — exactly what an AI design tool needs to reconstruct the full design system. Everything else in the original plan was just the same component with different text content.