# Native App — Master Implementation Plan

React Native / Expo implementation of the full Trackbit feature set.

**Branch:** `android` (current working branch)
**Stack:** Expo ~56, Expo Router, React 19, React Native 0.85, TypeScript strict

---

## Guiding principles

- **API-first** — every screen consumes the existing REST backend (`apps/backend`). No native-only data layer.
- **Parity with web** — the native app exposes the same features as `apps/frontend`; it is not a lite version.
- **Platform idioms** — use native navigation patterns (bottom tabs, stack push, native sheets) rather than porting the web layout.
- **Incremental auth** — build auth and session management first; every subsequent phase depends on it.

---

## Phase 0 — Foundation (current)

Bootstrapped Expo app with theming, tab navigation, and platform conventions established.

- [x] Expo project created (v56)
- [x] File-based routing via Expo Router
- [x] `Colors`, `Fonts`, `Spacing` token system in `constants/theme.ts`
- [x] `useTheme()` / `useColorScheme()` hooks with web overrides
- [x] `ThemedText` / `ThemedView` primitive components
- [x] Animated splash overlay
- [x] `NativeTabs` tab bar wired up
- [x] Path alias `@/` → `src/`

---

## Phase 1 — Auth & Session

**Goal:** users can sign in, stay signed in across launches, and sign out. Unauthenticated users cannot reach protected screens.

### Tasks

- [x] Install and configure an HTTP client (`ky` or `fetch` wrapper) with base URL from env
- [X] `src/lib/api.ts` — typed fetch helper, attaches session cookie / token
- [x] `src/lib/auth.ts` — sign-in, sign-up, sign-out, session check calls to `/api/auth/*`
- [x] Secure token storage — `expo-secure-store` for session token persistence
- [x] Auth context (`src/context/auth-context.tsx`) — `useAuth()` hook exposing `user`, `signIn`, `signOut`, `isLoading`
- [x] Route guard in `src/app/_layout.tsx` — redirect to `/auth/sign-in` when unauthenticated
- [X] `src/app/auth/sign-in.tsx` — sign-in screen (email + password form)
- [x] `src/app/auth/sign-up.tsx` — sign-up screen (name, email, password)
- [x] `src/app/auth/_layout.tsx` — auth stack layout (no tabs)
- [x] Form validation with Zod (match web validation rules)
- [x] Loading and error states on auth forms
- [x] "Remember me" — persist session vs. session-only cookie

### Dependencies added

```
expo-secure-store
zod
```

---

## Phase 2 — Habit List (Home Tab)

**Goal:** authenticated users see their habits list on the home tab with today's completion state and can mark habits done.

### Tasks

- [x] `src/lib/habits-api.ts` — typed wrappers for `GET /api/habits`, `POST /api/tracker`
- [x] `src/hooks/use-habits.ts` — React Query hook (`useQuery`) for habits list
- [x] `src/hooks/use-log-habit.ts` — React Query mutation for logging a habit
- [x] Install React Query (`@tanstack/react-query`) + `QueryClientProvider` in root layout
- [X] `src/app/(tabs)/index.tsx` — habits list screen
  - Flat list of habit rows
  - Completion checkbox / tap-to-log interaction
  - Optimistic update on log (match web UX)
  - Pull-to-refresh
  - Empty state
- [x] `src/components/habit-row.tsx` — single habit row component
- [x] `src/components/habit-list.tsx` — `FlatList` wrapper with section headers (active / frozen)
- [x] Frozen habit visual treatment (greyed out, locked icon)
- [x] Date header — "Today, May 25" above the list

### Dependencies added

```
@tanstack/react-query
```

---

## Phase 3 — Activity Logging (Log Screen)

**Goal:** users can log workout sets (exercise + reps + weight) and data-rich activities. Mirrors the tracker screen on web.

### Tasks

- [x] `src/app/(tabs)/log.tsx` — log screen (new tab); lists exercise habits, Start/Open session
- [x] Add "Log" tab trigger to `app-tabs.tsx` with icon (all tabs now have lucide icons)
- [x] `src/lib/tracker-api.ts` — typed wrappers for all tracker + exercise-info endpoints
- [x] `src/hooks/use-tracker.ts` — `useTodayHistory`, `useExercises`, `useHabitTodayLog`, `useActiveSession` selectors; `useStartExerciseSession`, CRUD mutations with optimistic updates
- [x] `src/app/session/_layout.tsx` — session stack layout (registered in root auth guard)
- [x] `src/app/session/[id].tsx` — session detail screen; expanded exercise log cards with per-set rows and "+ Add set" button
- [x] Exercise picker — searchable list from `GET /api/exercise-info`; "Add exercise" in session screen
- [x] `src/components/set-row.tsx` — single logged set; display (set #, reps × weight, RPE badge), tap-to-edit (inline reps + weight TextInputs), swipe-to-delete (Swipeable → `useDeletePerformance`); pending rows (id < 0) shown at reduced opacity
- [x] Swipe-to-delete on set rows — via `Swipeable` from `react-native-gesture-handler`
- [x] `src/components/rpe-selector.tsx` — RPE picker (native bottom sheet)
- [x] Add set form — RPE editing on set-row (requires `rpe-selector.tsx`); reps + weight inline editing already ships in `set-row.tsx`
- [x] Custom exercise creation flow

### Dependencies added

```
@gorhom/bottom-sheet   (or expo native sheet when stable in v56)
```

---

## Phase 4 — Analytics & Heatmap

**Goal:** users can view consistency heatmaps and habit analytics, matching the analytics tab on web.

### Tasks

- [ ] `src/app/(tabs)/analytics.tsx` — analytics tab
- [ ] `src/lib/analytics-api.ts` — typed wrappers for analytics endpoints
- [ ] `src/hooks/use-analytics.ts` — React Query hooks
- [ ] Heatmap component — `src/components/heatmap.tsx`
  - 52-week grid rendered with `react-native-svg` or custom `View` matrix
  - Color intensity matches `Colors` palette (primary blue gradient)
  - Touch to inspect a day
- [ ] Habit selector to switch which habit's heatmap is shown
- [ ] Streak counter row
- [ ] Weekly summary bar chart (optional, phase 4b)

### Dependencies added

```
react-native-svg
```

---

## Phase 5 — Settings & Profile

**Goal:** users can view their profile, change locale/timezone, and sign out from a Settings tab.

### Tasks

- [ ] `src/app/(tabs)/settings.tsx` — settings tab
- [ ] Add "Settings" tab trigger to `app-tabs.tsx`
- [ ] `src/components/settings-row.tsx` — tappable row for settings items
- [ ] Profile section — display name, email (read-only)
- [ ] Locale picker — `PATCH /api/me/preferences` on change (matches web locale switcher)
- [ ] Timezone picker — native scroll picker or modal list
- [ ] Sign-out button → calls `auth.signOut()`, redirects to sign-in
- [ ] App version / build info row

---

## Phase 6 — Habit Management (CRUD)

**Goal:** users can create, edit, reorder, and delete habits from within the app.

### Tasks

- [x] `src/app/habits/new.tsx` — create habit screen (modal stack)
- [x] `src/app/habits/[id]/edit.tsx` — edit habit screen
- [x] `src/app/habits/manage.tsx` — manage screen with drag-to-reorder + delete
- [x] `src/app/habits/_layout.tsx` — habits stack layout
- [x] Habit form component — name, type, anti-habit switch, daily/weekly goal, icon, color preset, mock gradient editor
- [x] `src/hooks/use-create-habit.ts` / `use-update-habit.ts` / `use-delete-habit.ts` / `use-reorder-habits.ts` mutations with optimistic updates
- [x] Reorder habits — drag-to-reorder via `react-native-draggable-flatlist`
- [x] Delete with Alert confirmation
- [x] Frozen habit treatment — lock badge, disabled save, disabled drag; delete still works
- [x] Error code branching — `habit_limit_reached`, `habit_type_not_allowed`, `habit_frozen`, `habit_order_conflict` → native Alert
- [x] Settings tab updated with "Manage habits" entry point
- [x] `GestureHandlerRootView` added to root layout

---

## Phase 7 — Push Notifications

**Goal:** daily reminders for habit logging (opt-in, per-habit).

### Tasks

- [ ] `expo-notifications` integration
- [ ] Permission request flow
- [ ] Per-habit reminder time picker
- [ ] Store notification schedule on device (no backend change needed initially)
- [ ] Background task to trigger local notification at scheduled time

### Dependencies added

```
expo-notifications
expo-task-manager
expo-background-fetch
```

---

## Phase 8 — Polish & Release Prep

- [ ] App icon final assets (all required sizes for App Store + Play Store)
- [ ] Splash screen final design
- [ ] `app.json` — set correct `slug`, `bundleIdentifier` (iOS), `package` (Android)
- [ ] EAS Build setup (`eas.json`) for production builds
- [ ] EAS Submit workflow for both stores
- [ ] OTA update strategy (`expo-updates`)
- [ ] Accessibility — `accessibilityLabel` on all interactive elements
- [ ] Error boundary component
- [ ] Crash reporting (`expo-application` + Sentry or similar)

---

## Screen map

```
/                          Root layout (auth guard)
├── /auth/sign-in          Sign-in screen
├── /auth/sign-up          Sign-up screen
└── /(tabs)/               Tab navigator
    ├── index              Habits list (Home)
    ├── log                Activity log
    ├── analytics          Heatmap + analytics
    └── settings           Profile + preferences
        └── /habits/new    Create habit (modal)
        └── /habits/[id]/edit  Edit habit (modal)
```

---

## API dependency map

| Phase | Endpoints consumed |
|-------|--------------------|
| 1 | `POST /api/auth/sign-in`, `POST /api/auth/sign-up`, `POST /api/auth/sign-out`, `GET /api/auth/session` |
| 2 | `GET /api/habits`, `POST /api/tracker`, `DELETE /api/tracker/:id` |
| 3 | `GET /api/exercise-info`, `POST /api/tracker` (sets), `GET /api/tracker` |
| 4 | `GET /api/analytics/*` (TBD endpoint — may need backend additions) |
| 5 | `GET /api/me`, `PATCH /api/me/preferences` |
| 6 | `POST /api/habits`, `PATCH /api/habits/:id`, `DELETE /api/habits/:id`, `PATCH /api/habits/order` |
| 7 | (local only) |

---

## Open questions / decisions

- **Auth transport** — does the backend use cookies or bearer tokens? Verify `apps/backend/src/lib/auth.ts` before implementing Phase 1.
- **Offline support** — React Query's stale-while-revalidate is sufficient for Phase 2/3; full offline (queue) is out of scope for now.
- **Analytics endpoints** — the backend may need new endpoints for heatmap data in Phase 4; coordinate with backend work.
- **Monorepo integration** — the native app currently uses its own `npm` with a separate `node_modules`. Evaluate moving to `pnpm` workspace in Phase 8 for shared `packages/types`.
