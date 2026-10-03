# Kotlin Android App — Master Plan

A native Android client for Trackbit written in Kotlin + Jetpack Compose. It consumes the existing Hono REST API ([apps/backend](../../../apps/backend)) and is built **widgets-first**. The order of the work is:

1. **Android widgets.** These are the reason to go native and are the most useful to users day to day.
2. **Main features.** Tracker, workout sessions and analytics.
3. **Settings and configuration.** Habit configuration, exercise library, exercise lists and account preferences.

Before any of these can ship, a thin foundation (auth, API client, local cache) and a few backend changes have to exist. Those are Phase 0 below, split so that several people or agents can work in parallel.

**Branch:** `kotlin-app`
**Status:** Phase 0 done 2026-09-26 ([handoff](../handoffs/kotlin-app-B.md)). Phase 1 done on the emulator 2026-10-02 ([handoff](../handoffs/kotlin-app-C.md)). Phase 2 D1–D6 done on the emulator by 2026-10-03 ([handoff](../handoffs/kotlin-app-D.md)); its exit check is deferred to the final pass with the real-device check (user, 2026-10-03). Phase 3 in progress: split E1–E6, E1 (Settings tab + habits config) done 2026-10-03 ([handoff](../handoffs/kotlin-app-E.md)).
**Deferred follow-ups:** [kotlin-app-followups.md](kotlin-app-followups.md) (non-blocking issues and checks, to pick up after Phase 1).

---

## 0. Decisions (resolved 2026-09-24)

| # | Question | Decision |
|---|---|---|
| D1 | **What happens to the Expo app?** The `android` branch has an Expo/React Native app (plan in `docs/tasks/native-app.md` on that branch) at Phase 4b. | **Discontinued.** Kotlin is the Android client. Carry over only its backend change (Better-Auth `bearer` plugin, see A1). Its screens can serve as a UX reference while the branch still exists. **Cleanup:** delete the `android` branch (local and `origin`) once A1 has landed on `kotlin-app`. |
| D2 | **Android only, or iOS later?** | **Android only.** Plain Kotlin + Compose, no Kotlin Multiplatform. `core/*` stays free of Android UI code, so a future move to KMP remains possible, but that is not a goal. |
| D3 | **Online-first or offline-first?** | **Offline-tolerant now, fully offline later.** Now: everything reads from a local cache (Room), and tracking writes (habit logs, sets) go through a queue of pending writes (the outbox), so they work without a connection. Configuration screens (habits, library, lists, account) require a connection. Later: full offline capability, deferred to Phase 4. |
| D4 | **Where do the DTOs come from?** `@trackbit/types` is TypeScript and Kotlin cannot use it. | **Handwritten now, generated later.** Now: handwritten `@Serializable` DTOs in `core/model`, plus contract tests against a local backend. Later: generate them from an OpenAPI spec, deferred to Phase 4. |
| D5 | **minSdk / targetSdk** | **minSdk 26** (Android 8), which Glance and modern Compose need. Target the latest stable SDK. As built (B1): compileSdk 37, because current AndroidX requires it; targetSdk 36. Raising targetSdk to 37 is a separate change, since it alters runtime behaviour. |
| D6 | **Distribution** | **Play Console internal testing**, with a debug APK built in CI. Package id **`com.trackbit.app`**. |
| D7 | **Where the project lives** | **`apps/android/`**, a standalone Gradle project in the monorepo. It is not a pnpm workspace and is not part of Turborepo's `build` pipeline. It gets its own `pnpm android:*` convenience scripts at the root. |

---

## 1. Tech stack (proposed)

| Concern | Choice | Why |
|---|---|---|
| UI | Jetpack Compose + Material 3 (dynamic color, with the Trackbit palette as fallback) | Standard, and it pairs with Glance |
| Widgets | **Jetpack Glance** (`glance-appwidget`, `glance-material3`) | Compose-style API for App Widgets |
| Navigation | Navigation Compose (type-safe routes) | |
| DI | Hilt | Glance receivers, WorkManager workers and ViewModels all need injection, and Hilt covers all three |
| Networking | Retrofit + OkHttp + kotlinx.serialization | OkHttp interceptors for the bearer token, `Accept-Language` and the timezone |
| Local data | Room (cache + outbox) + DataStore (preferences, token metadata) | Widgets read from Room and never from the network |
| Background | WorkManager | Syncing, flushing the outbox, rolling over at midnight |
| Secure storage | Android Keystore-backed encryption (Tink) for the session token | |
| Dates | `java.time` (with desugaring if needed) | Plays the same role as luxon in the web app |
| Charts | Vico | For analytics |
| i18n | `strings.xml` (en, es), generated from the web locale JSON (see §5.4) | |
| Build | Gradle version catalogs, convention plugins in `build-logic/` | Keeps the modules consistent |

---

## 2. Architecture

### 2.1 Module layout

Modules are the unit of "divide and conquer". Each workstream owns a set of modules and has few merge conflicts with the others.

```
apps/android/
  app/                    → Application, MainActivity, nav graph, Hilt root
  build-logic/            → convention plugins
  core/
    model/                → @Serializable DTOs + domain models (pure Kotlin, no Android)
    network/              → Retrofit services, auth interceptor, error mapping
    database/             → Room DB, DAOs, entities, outbox table
    data/                 → repositories (network ↔ Room), sync logic, WorkManager workers
    auth/                 → session store, sign-in/out, auth state Flow
    designsystem/         → theme, colors/gradients, icons, shared composables (Heatmap, Stepper, RPE…)
    i18n/                 → generated string resources
  feature/
    tracker/              → today screen, habit rows (check/count/timed/exercise)
    session/              → workout session: logs, sets, picker, rest timer
    analytics/            → stats, heatmaps, charts
    habits-config/        → habit CRUD, reorder, color/icon pickers
    exercise-library/     → exercise catalog CRUD
    exercise-lists/       → lists CRUD + reorder
    account/              → preferences, locale, units, sign-out
    auth/                 → sign in / sign up / forgot / verify screens
  widget/                 → all Glance widgets, receivers, widget ActionCallbacks
```

Dependency rule: `feature/*` and `widget` depend on `core/*` only and never on each other. `app` wires them together.

### 2.2 Data flow

```
             ┌────────────┐   read (Flow)    ┌──────────────┐
 Compose UI ─┤ ViewModel  ├─────────────────►│ Repository   │
 Glance     ─┤ / Glance   │                  │ (core/data)  │
             └─────┬──────┘                  └──┬───────┬───┘
                   │ write                      │       │
                   ▼                            ▼       ▼
             Repository.write()            Room cache  Retrofit
             1. apply optimistic change to Room          ▲
             2. append op to outbox                      │
             3. enqueue OutboxWorker ────────────────────┘
             4. GlanceAppWidget.updateAll()
```

- **Room is the single source the UI reads from**, both in the app and in widgets. The network only ever writes *into* Room.
- **Every mutation goes through the outbox**, whether it starts in the app or in a widget. This does in native form what the optimistic updates in `use-tracker.ts` do on the web. It is also the only safe design for widget taps, which run with no UI and can happen offline.
- **After any Room change to tracker tables**, the app refreshes the widgets. One `WidgetUpdater` in `core/data` watches the DAOs and calls `updateAll`, so feature code never has to remember to do it.

### 2.3 Auth

- Enable the Better-Auth **`bearer` plugin** on the backend. The `android` branch already did this: `bearer({ requireSignature: true })` in [auth.ts](../../../apps/backend/src/lib/auth.ts).
- Sign-in calls `POST /api/auth/sign-in/email`. The app reads the `set-auth-token` response header and stores the token encrypted. An OkHttp interceptor adds `Authorization: Bearer …` to every request.
- A 401 on any request clears the token and routes to sign-in. Widgets show a "Sign in to Trackbit" state.
- Social login (Google) is deferred to Phase 3. It needs Credential Manager plus a Better-Auth `idToken` sign-in, or a custom-tab OAuth flow with an app deep link added to `trustedOrigins`.

---

## 3. Backend prerequisites (Workstream A)

These are **root-cause fixes**. Without them the native client has to work around server behaviour, and every client would carry the same workaround. They benefit the web app too.

**Status: A1–A10 shipped 2026-09-24** on `kotlin-app` (A6 client side is B's job). Tests: `pnpm --filter backend test` (Vitest against a throwaway Postgres, see [apps/backend/test](../../../apps/backend/test)). CI: [.github/workflows/backend.yml](../../../.github/workflows/backend.yml).

| # | Change | As built |
|---|---|---|
| A1 | Better-Auth `bearer` plugin. | `bearer({ requireSignature: true })` in [auth.ts](../../../apps/backend/src/lib/auth.ts). Sign-in returns the token in the `set-auth-token` header. |
| A2 | Ownership check on tracker writes. | `assertTrackableHabit` in [tracker.ts](../../../apps/backend/src/routes/app/tracker.ts): another user's habit → 404 `habit_not_found`, frozen → 403 `habit_frozen`. |
| A3 | Server owns "today". | **`day_logs.local_day date NOT NULL` + `UNIQUE(habit_id, local_day)`** (migration `0008`, backfilled from the user's timezone). Writes take an optional `day: 'YYYY-MM-DD'`; when omitted the server uses today in `user.timezone` ([user-day.ts](../../../apps/backend/src/lib/user-day.ts)). `?tz=` is gone everywhere. `timezone` is validated as an IANA zone at every write boundary (signup, update-user, `PATCH /api/me/preferences`). |
| A4 | Atomic increment. | `POST /api/tracker/check/increment { habitId, delta, day? }` → `INSERT … ON CONFLICT (habit_id, local_day) DO UPDATE SET rating = coalesce(rating,0) + delta`. `POST /check { habitId, rating, day? }` is the absolute upsert. `POST /day-logs/ensure { habitId, day? }` returns the day's row, creating an empty one (used to attach sessions). The CRUD `POST /day-logs` is removed; `PATCH /day-logs/:id` can no longer change `habitId`/`localDay`. All three return the `day_logs` row. |
| A5 | Today summary. | `GET /api/tracker/today?day=` → `{ day, habits: [{ id, name, description, type, isAntiHabit, icon, colorTheme, colorStops (resolved), dailyGoal, weeklyGoal, order, frozen, firstLogDay, streakBeforeDay, recent: [{ day, rating, sessionCount }] ×7, oldest first }] }`. **Clients compute the current streak** as `dayCounts(today) ? streakBeforeDay + 1 : 0` with their own (optimistic) value for today; rules in [streak.ts](../../../apps/backend/src/lib/streak.ts), mirroring the web `computeStreak`. |
| A6 | Bounded history. | `/history?start&end` filters on `local_day` and validates both. The native client must always pass a window. |
| A7 | Idempotency keys. | **Required, not optional:** increments are commutative but *not* idempotent, so a lost response + retry would double-count. `Idempotency-Key` header (≤255 chars), opt-in per route via [idempotency.ts](../../../apps/backend/src/middleware/idempotency.ts); on `/check`, `/check/increment`, `/day-logs/ensure`, and since D2 on session, log and set creation. 2xx responses are stored per (user, key) for 24 h and replayed with `idempotent-replayed: true`; failures release the key; same key on another route → 422; concurrent duplicate → 409. Session rows also take a client-chosen `uuid` (D2, migration `0011`), which makes their creates idempotent by themselves. |
| A8 | Origin-less native requests. | No config change needed: sign-in, get-session, API calls and sign-out all work with a bearer token and no `Origin` ([bearer-auth.test.ts](../../../apps/backend/test/bearer-auth.test.ts)). |
| A9 | Typed preference fields on the session. | `unitSystem` and `exerciseLogCardStyle` declared in `additionalFields` (`input: false`); `get-session` returns all five preferences. |
| A10 | Canonical habit appearance. | `HABIT_ICON_IDS`, `COLOR_THEMES`, `GRADIENT_PRESET_STOPS`, `resolveColorStops` in [@trackbit/types](../../../packages/types/src/habit-appearance.ts). The backend validates `icon` against the list; the web icon registry is [habit-icons.ts](../../../apps/frontend/src/features/habits-configuration/habit-icons.ts) (fixes 9 icons rendering as `Activity` and `alert` as `Trophy`). The Android generator reads the same module. |

---

## 4. Phases

Each phase lists its **exit criteria**. A phase is done when those are met, not when every checkbox is ticked.

### Phase 0 — Foundation (Workstreams A + B, in parallel)

**Goal:** a signed-in user's habits are synced into Room, and a debug build can show them on a plain screen.

- [x] A1–A10 backend prerequisites (Workstream A), see §3
- [x] **B1** Gradle project in `apps/android`: version catalog, `build-logic` convention plugins (`trackbit.android.application/library/compose`, `trackbit.hilt`, `trackbit.room`, `trackbit.jvm.library`), module stubs from §2.1, `BuildConfig.API_BASE_URL` (`http://10.0.2.2:3000` in debug, with a debug-only cleartext network config), root `pnpm android:*` scripts, CI job `.github/workflows/android.yml` (assemble + unit tests + lint, debug APK artifact)
- [x] **B2** `core/model`: `@Serializable` DTOs (Habit, DayLog with `localDay`, `TodayResponse`, Exercise, ExerciseSession/Log/Performance, ExerciseList/Item, session user with the 5 preferences, Limits, request bodies). Enums with an unknown fallback. Pure domain helpers with unit tests: `Streak.current(...)` (ports [streak.ts](../../../apps/backend/src/lib/streak.ts) `dayCounts`) and `HabitProgress` (timed ratings are ms against a goal in minutes)
- [x] **B3** `core/network`: Retrofit services (auth, tracker, habits, me), bearer + `Accept-Language` interceptors, `Idempotency-Key` from a request tag, `safeCall` mapping to a sealed `ApiError` (`Unauthorized`, `HabitFrozen`, `CustomExerciseFrozen`, `NotFound`, `Validation`, `Server`, `Network`, `Unknown`). MockWebServer tests
- [x] **B4** `core/auth`: Tink/Keystore-encrypted token in DataStore, `AuthState` StateFlow, sign-in reads `set-auth-token`, cached session user for offline boot, any 401 → signed out. As built: token + user encrypted together in one typed DataStore file; sign-in adopts the token only after `get-session` confirms it; `SignOutHook`s (Room clear in `core:data`) run on every sign-out and at a signed-out startup
- [x] **B5** `core/database`: `HabitEntity` (+ `frozen`, `firstLogDay`, `streakBeforeDay`, `summaryDay`), `DayLogEntity` (PK `habitId, localDay`), `OutboxEntity` (UUID idempotency key fixed at enqueue). The today summary is a DAO projection (habit + today's log + last 7), not a table
- [x] **B6** `core/data`: repositories; every write = one Room transaction (optimistic change + outbox op), then enqueue `OutboxWorker` and call `WidgetUpdater` (no-op until Phase 1). `OutboxWorker`: FIFO, backoff on network/5xx, drop + resync on 4xx, stop on 401. `SyncWorker` (15 min + on demand): flush outbox → `GET /tracker/today` → write Room **without clobbering rows that still have pending ops** — *As built (2026-09-26):* no `WidgetUpdater` yet (Phase 1 adds it; it watches the DAOs, so writes need no call). Periodic `SyncWorker` only; on-demand sync is `TrackerRepository.refresh()` in-process. 5xx/409 are retried 10 times, then dropped + resynced, so one bad op can't block the FIFO forever.
- [x] **B7** Contract tests: a backend Vitest suite writes real, normalized responses to `apps/android/core/model/src/test/resources/contracts/`; CI fails if they change unexpectedly; a Kotlin test decodes each one — *As built (2026-09-26):* [contracts.test.ts](../../../apps/backend/test/contracts.test.ts) records `{ request, status, body }` via `toMatchFileSnapshot` (success bodies → `core/model`, error bodies → `core/network`, where `ApiError` lives); `pnpm --filter backend test:contracts:update` re-records. `DecodeTest` and `ErrorContractTest` fail on a recorded file they don't cover. It found two drifts: `/me/limits` sends `effective: null` for admins (DTO now nullable), and two frozen 403s had no id (one shared helper now).
- [x] **B8** `core/designsystem`: M3 light/dark schemes from the web's oklch tokens, dynamic color with fallback, gradient presets generated from `@trackbit/types`, `colorAt(stops, t)`, the 15 `HABIT_ICON_IDS` as Lucide vector drawables (fallback `star`)
- [x] **B9** `scripts/gen-strings.mjs` (as built: `apps/android/scripts/generate.mjs`, which also emits B8's presets, colors and icons): web locale JSON → `strings.xml` (en, es), ICU → format args, plurals; also emits the gradient presets. CI checks the output is current
- [x] **B10** Sign-in screen (email + password) and a placeholder Today screen (rows from Room, +1/toggle through the outbox, pull-to-refresh, sign-out) — *As built (2026-09-26):* `feature:auth` (`SignInScreen`) and the new `feature:tracker` (`TodayScreen`, `DayClock` for the midnight rollover), both on a `trackbit.android.feature` convention plugin. `app` routes on `AuthState` with one graph per state and calls `AuthRepository.refresh()` once per launch. The exit criteria were checked on the emulator against the local backend.

Order: B1 → B2 → (B3 ∥ B5 ∥ B8 ∥ B9) → B4 → B6 → B10; B7 after B2.

**Exit:** sign in, and see today's habits (from Room) on a placeholder screen. Toggling airplane mode doesn't break reading.

### Phase 1 — Widgets ⭐ (Workstream C)

**Goal:** a user can track their day from the home screen without opening the app.

Widgets, in priority order:

| # | Widget | Sizes | Interaction |
|---|---|---|---|
| W1 | **Habit quick-log** (one habit, chosen in the config activity) | 1×1, 2×1, 2×2 | Tap: toggle for `check`, +1 for `count`, start/stop for `timed`. Shows today's progress ring and streak. The 2×2 size adds a 7-day strip. |
| W2 | **Today list** (all active habits) | 4×2 → 4×4 resizable | One row per habit with progress and a tap-to-log button. Frozen habits are greyed out with a lock. The header opens the app. |
| W3 | **Habit heatmap** (one habit) | 4×2, 4×3 | Read-only. Last N weeks using the habit's color gradient, the same scale as the web `Heatmap`. Tap opens analytics. |

There is no workout widget, by design. Exercise sessions are handled inside the app (Phase 2). Tapping an exercise-type habit in W1/W2 opens today's session in the app instead of logging from the widget.

This phase also builds the **timer infrastructure** that W1 (timed habits) needs. Phase 2 reuses it for the rest timer:

- [x] **Timer engine** in `core/data`: timer state is persisted locally as a start timestamp plus a duration, not as a ticking counter, so it survives process death. The web `ControlledTimer` keeps state in memory only, so this is new behaviour.
- [x] **Ongoing timer notification**: a Chronometer notification with Stop / +30s actions. Built without a foreground service (C3 decision: nothing needs to run while the stored timer ticks in SystemUI).

Tasks:

- [x] `widget` module: `GlanceAppWidget` + receiver per widget. Everything shown is read from Room through `TrackerRepository`; Glance state holds only a habit widget's chosen habit (C1–C2 decision).
- [x] Widget configuration activity (one habit picker, `HabitPickerActivity`) for W1 and W3
- [x] `ActionCallback`s → `TrackerRepository.increment/toggle` → outbox. No network call inside the callback.
- [x] Refresh triggers: after any tracker DAO change (via `WidgetUpdater`), periodic `SyncWorker` (15 min), **local-midnight rollover** (non-wakeup alarm at the next local midnight), and on auth change
- [x] Signed-out, empty, frozen and error states for every widget
- [x] W3 history beyond the week: `GET /api/tracker/days` (added in C4), kept in `day_logs` while a heatmap is placed
- [x] Widget previews: static `previewLayout` on Android 12+, generated previews on 15+ (sample habits, republished on update and locale change). None on 8–11 (follow-up).
- [x] Dark mode + dynamic color in widgets

**Exit:** W1 + W2 installed on a real device. Logging from the widget while offline appears on the web after reconnecting, with no duplicates. The widgets reset correctly at midnight.

### Phase 2 — Main features (Workstream D)

**Goal:** the app does everything the web app's daily-use screens do.

- [x] **Tracker home** (`feature/tracker`, D1 2026-10-02): date selector, habit rows for each type (check, count stepper, timed with the notification timer, exercise → opens the session), progress and streak badges, anti-habit handling
- [x] **Workout session** (`feature/session`; D3 + D4 2026-10-02; the rest timer is D5): session panel, exercise log cards (compact + full, respecting `exerciseLogCardStyle`), set editor (reps/weight/duration/distance/RPE), unit system, exercise picker with **exercise sources** (lists, browse mode, catalog search, as described in [exercise-programs.md](exercise-programs.md)), and the Play/next behaviour
- [x] **Analytics** (`feature/analytics`, D6 2026-10-03; Stats tab in a bottom bar; sets from `GET /api/tracker/sets` cached in Room v8; muscle balance as bars): habit heatmaps, volume / muscle / exercise charts (Vico), segmented control
- [x] **Rest timer** (D5 2026-10-02; adding a set starts it; exact alarm with an inexact fallback for the end alert) (new, not on the web yet): after a set is logged, a rest countdown starts automatically. The default duration comes from a user setting, overridden by the list item's prescribed rest when the exercise came from a list with prescriptions. Controls: skip, +/−15s. It runs on the timer engine from Phase 1, so it shows in the ongoing notification, survives the app being backgrounded, and vibrates or sounds when it ends. Needs a `defaultRestSeconds` preference (backend: add it to `PATCH /api/me/preferences`).
- [x] Session outbox ops (D2 2026-10-02): create/delete session, add/remove log, add/edit/delete a set; rows named by client uuids, every op with an idempotency key
- [x] Pull-to-refresh + sync indicator (D1; pending-writes line)
- [ ] Error-code handling: frozen habit/exercise → snackbar with the same copy as the web (`errors:limits.*`)

**Exit:** a full workout can be logged in the app, and a day of habits can be tracked, with results identical to the web. *Deferred (user, 2026-10-03): checked in the final pass together with the real-device check.*

### Phase 3 — Settings & configuration (Workstream E)

**Goal:** a user never needs the web app.

Split (user, 2026-10-03): a third bottom tab **Settings** hub (`feature/account`) opens every screen below. E1 habits config · E2 account · E3 exercise library · E4 exercise lists · E5 auth screens · E6 issue report. Config needs a connection (D3): screens read the server, writes go straight to it, and a sync then refreshes Room.

- [x] **Habits config** (E1 2026-10-03, `feature/habits-config`): list, create/edit form (type, anti-habit, goals, color theme or custom gradient, icon), reorder (drag, also across groups), delete. The form's rules are `HabitRules` in core:model and the server enforces the same (name 3–50 trimmed, daily goal ≤ 1440, no structured anti-habit, migration `0013`); role limits from `GET /api/me/limits`.
- [ ] **Exercise library**: catalog browse/search by muscle group, create/edit/delete custom exercises, frozen state
- [ ] **Exercise lists**: CRUD, reorder items, add to list from the picker/library
- [ ] **Account**: locale (en/es), timezone, unit system, card style, preferred exercise source (`PATCH /api/me/preferences`), sign-out
- [ ] Remaining auth screens: sign-up (with invite code), forgot password, verify-email handling. Google sign-in deferred to the backlog (user, 2026-10-03): it needs an Android OAuth client in Google Cloud and a Better-Auth id-token sign-in.
- [ ] Feedback/issue report (`POST /api/issues`)

**Exit:** feature parity with `apps/frontend` routes (`/tracker`, `/sessions`, `/stats`, `/config/*`, `/account-settings`).

### Phase 4 — Deferred (decided, not scheduled)

**Full offline capability (D3).**
- [ ] Route configuration writes (habit, exercise, list and preference CRUD) through the outbox too, not only tracking writes.
- [ ] Client-generated ids, or a temp-id → server-id remapping in the outbox, so offline-created habits and exercises can be referenced by later offline ops (for example, log a habit created offline).
- [ ] Conflict policy for configuration edits (per-field last-write-wins with `updatedAt` on the server, or reject + refetch).
- [ ] Limit checks (`/api/me/limits`) cached locally, and a UX for an offline create that the server later rejects.

**OpenAPI-generated DTOs (D4).**
- [ ] Migrate the backend routes to `@hono/zod-openapi`, so the Zod schemas that already validate requests also describe responses.
- [ ] Publish `openapi.json` from the backend build, and consider generating `@trackbit/types` from it too, so the web app shares the same source.
- [ ] Generate the Kotlin models (openapi-generator, kotlinx.serialization) into `core/model` and delete the handwritten DTOs.
- [ ] Keep the contract tests as a regression check.

**Cleanup.**
- [ ] Delete the `android` (Expo) branch, local and `origin` (D1), once A1 is merged.

### Later / backlog

- Google sign-in (Credential Manager + Better-Auth `idToken` sign-in, or a custom-tab OAuth flow; needs an Android OAuth client: package + SHA-1)
- App shortcuts (long-press icon → "Start workout", "Log <habit>")
- Quick Settings tile for one habit
- Reminders / scheduled notifications per habit (needs a backend model)
- Wear OS tile
- Health Connect export of workouts

---

## 5. Divide & conquer

### 5.1 Workstreams

| Stream | Scope | Can start | Blocks |
|---|---|---|---|
| **A — Backend** | §3 A1–A8 | now | B's contract tests, C's widget data (A4, A5) |
| **B — Core** | `core/*`, Gradle setup, CI, sign-in screen | now | C, D, E |
| **C — Widgets** | `widget/`, timer notification | when B has Room entities + repositories (a fake repository is fine to start UI earlier) | — |
| **D — Main features** | `feature/tracker`, `session`, `analytics` | when B is done; tracker can start against a fake repository | — |
| **E — Config** | `feature/habits-config`, `exercise-library`, `exercise-lists`, `account`, `auth` | when B is done | — |

```
A ──┬──────────────► (A4/A5 needed by C)
B ──┴─► C (widgets) ─┐
        D (features) ├─► release
        E (config)  ─┘
```

C, D and E touch disjoint modules, so they run fully in parallel once B lands. Following the priority order, **C starts first**.

### 5.2 Suggested task size

One task = one PR = one module, or one screen or widget. Each task should fit a single agent run. Multi-run tasks leave a handoff in `docs/dev/handoffs/kotlin-app-<stream>.md` per [the handoff guide](../handoffs/README.md).

### 5.3 Shared contracts to agree first

To avoid rework, freeze these before C/D/E fan out:

1. Room entities + DAO signatures for habits, today summary and day logs (`core/database`)
2. Repository interfaces (`core/data`): `observeToday()`, `increment(habitId, delta)`, `toggle(habitId)`, `setRating(...)`, session ops
3. Design tokens + the habit-icon mapping (`core/designsystem`)
4. `ApiError` sealed hierarchy (`core/network`)

### 5.4 i18n

- The web app has namespaced JSON under [apps/frontend/src/i18n/locales](../../../apps/frontend/src/i18n/locales) (en, es). Don't hand-copy strings. A small script ([apps/android/scripts/generate.mjs](../../../apps/android/scripts/generate.mjs))  converts the JSON into `values/strings.xml` and `values-es/strings.xml`, prefixing keys with their namespace (`tracker_…`). It converts ICU placeholders to Android format args.
- Android-only strings (widget labels, notification actions) go in a separate hand-written `strings_android.xml`.
- The in-app locale switcher uses per-app language (`AppCompatDelegate.setApplicationLocales`) and PATCHes `/api/me/preferences`, just as the web does.

---

## 6. Risks & open issues

- **Type drift (D4).** Handwritten DTOs will drift from the backend. The contract tests catch it in CI until OpenAPI generation lands (Phase 4).
- **Widget freshness.** Android limits widget update frequency. Updates driven by user action are immediate. Changes made on the web appear only on the next sync (≤15 min) unless push is added later (FCM, backlog).
- **Timezone edge cases.** After A3 the server owns "today". The device timezone can still differ from the stored one while travelling. Proposal: when the device timezone changes, prompt the user and PATCH preferences.
- **Outbox conflicts.** Increments are commutative (A4), so reordering is safe, but they are not idempotent: every outbox op carries an `Idempotency-Key` fixed at enqueue time (A7). Absolute edits (set editor) use last-write-wins. That's acceptable for a single-user app, but document it.
- **Frozen items** must be enforced locally for UX (disable the widget tap). The server stays authoritative.
