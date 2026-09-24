# Kotlin Android App — Master Plan

A native Android client for Trackbit written in Kotlin + Jetpack Compose. It consumes the existing Hono REST API ([apps/backend](../../apps/backend)) and is built **widgets-first**. The order of the work is:

1. **Android widgets.** These are the reason to go native and are the most useful to users day to day.
2. **Main features.** Tracker, workout sessions and analytics.
3. **Settings and configuration.** Habit configuration, exercise library, exercise lists and account preferences.

Before any of these can ship, a thin foundation (auth, API client, local cache) and a few backend changes have to exist. Those are Phase 0 below, split so that several people or agents can work in parallel.

**Branch:** `kotlin-app`
**Status:** planning. Decisions resolved 2026-09-24.

---

## 0. Decisions (resolved 2026-09-24)

| # | Question | Decision |
|---|---|---|
| D1 | **What happens to the Expo app?** The `android` branch has an Expo/React Native app (plan in `docs/tasks/native-app.md` on that branch) at Phase 4b. | **Discontinued.** Kotlin is the Android client. Carry over only its backend change (Better-Auth `bearer` plugin, see A1). Its screens can serve as a UX reference while the branch still exists. **Cleanup:** delete the `android` branch (local and `origin`) once A1 has landed on `kotlin-app`. |
| D2 | **Android only, or iOS later?** | **Android only.** Plain Kotlin + Compose, no Kotlin Multiplatform. `core/*` stays free of Android UI code, so a future move to KMP remains possible, but that is not a goal. |
| D3 | **Online-first or offline-first?** | **Offline-tolerant now, fully offline later.** Now: everything reads from a local cache (Room), and tracking writes (habit logs, sets) go through a queue of pending writes (the outbox), so they work without a connection. Configuration screens (habits, library, lists, account) require a connection. Later: full offline capability, deferred to Phase 4. |
| D4 | **Where do the DTOs come from?** `@trackbit/types` is TypeScript and Kotlin cannot use it. | **Handwritten now, generated later.** Now: handwritten `@Serializable` DTOs in `core/model`, plus contract tests against a local backend. Later: generate them from an OpenAPI spec, deferred to Phase 4. |
| D5 | **minSdk / targetSdk** | **minSdk 26** (Android 8), which Glance and modern Compose need. Target the latest stable SDK. |
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

- Enable the Better-Auth **`bearer` plugin** on the backend. The `android` branch already did this: `bearer({ requireSignature: true })` in [auth.ts](../../apps/backend/src/lib/auth.ts).
- Sign-in calls `POST /api/auth/sign-in/email`. The app reads the `set-auth-token` response header and stores the token encrypted. An OkHttp interceptor adds `Authorization: Bearer …` to every request.
- A 401 on any request clears the token and routes to sign-in. Widgets show a "Sign in to Trackbit" state.
- Social login (Google) is deferred to Phase 3. It needs Credential Manager plus a Better-Auth `idToken` sign-in, or a custom-tab OAuth flow with an app deep link added to `trustedOrigins`.

---

## 3. Backend prerequisites (Workstream A)

These are **root-cause fixes**. Without them the native client has to work around server behaviour, and every client would carry the same workaround. They benefit the web app too.

| # | Change | Why |
|---|---|---|
| A1 | Add the `bearer` plugin to Better-Auth (reuse the change from `android`). | Native clients can't rely on cross-site cookies. |
| A2 | **Ownership check on `POST /api/tracker/check`.** Today it only checks `frozen`. There is a `//TODO` at [tracker.ts:127](../../apps/backend/src/routes/app/tracker.ts#L127), and any user can write a log for any `habitId`. | Security bug. A second client makes it more exposed. Fix it before shipping anything. |
| A3 | **Resolve `tz` from the user's stored timezone** (added in i18n Phase 2) instead of `c.req.query('tz') \|\| 'America/Costa_Rica'` in `/history` and `/check`. Keep `?tz=` only as an explicit override, if at all. | Widgets run in the background and should not have to know or send the timezone. One source of truth for "what day is it for this user". |
| A4 | **Atomic increment endpoint**, e.g. `POST /api/tracker/check/increment { habitId, delta, timeStamp }`, which does `rating = rating + delta` in a single upsert. | `/check` takes an *absolute* rating. A widget "+1" would have to read, modify and write, and it would race with the web app or a second widget. A server-side increment makes the outbox op commutative, so retries and reordering are safe. |
| A5 | **Lightweight today summary**: `GET /api/tracker/today` returns, per habit: id, name, type, icon, color stops, daily/weekly goal, today's rating, current streak, the last 7 days of ratings, and `frozen`. | `/history` returns *all* history with nested sessions, logs and performances. That is far too heavy for a widget refresh every 15 minutes. |
| A6 | **Bounded history**: make `/history` honour `start`/`end` from the client (it already supports them) and have the native client always pass a window, for example 26 weeks. | Keeps the sync payload bounded. |
| A7 | **Idempotency key** on outbox-driven writes (an `Idempotency-Key` header, deduplicated server-side for 24h), at least for set/performance creation. | If a request succeeds but the response never arrives, the outbox resends it. Without a key that creates a duplicate set. |
| A8 | CORS/origin audit: requests with no `Origin` from native must pass Better-Auth's CSRF check when bearer auth is used. Add a smoke test. | |

A2–A5 are small and independent, so they can be separate PRs.

---

## 4. Phases

Each phase lists its **exit criteria**. A phase is done when those are met, not when every checkbox is ticked.

### Phase 0 — Foundation (Workstreams A + B, in parallel)

**Goal:** a signed-in user's habits are synced into Room, and a debug build can show them on a plain screen.

- [ ] A1–A5 backend prerequisites (Workstream A)
- [ ] Gradle project in `apps/android`, version catalog, `build-logic` conventions, CI job (assemble + unit tests + lint)
- [ ] `core/model`: DTOs for Habit, DayLog, today summary, Exercise, ExerciseSession/Log/Performance, ExerciseList, Preferences, Limits
- [ ] `core/network`: Retrofit services, bearer + `Accept-Language` interceptors, error mapping to a sealed `ApiError` (including `habit_frozen` and `custom_exercise_frozen`)
- [ ] `core/auth`: encrypted token store, `AuthState` Flow, sign-in/sign-out
- [ ] `core/database`: entities for habits, day logs and today summary; the outbox table
- [ ] `core/data`: `HabitRepository`, `TrackerRepository`, `SyncWorker` (periodic + on-demand), `OutboxWorker` (with backoff and idempotency keys)
- [ ] `core/designsystem`: theme tokens ported from the web (colors, gradient presets from `ColorThemeField`, habit icons mapped from lucide names to vector drawables)
- [ ] Minimal sign-in screen (email + password) so the rest can be tested
- [ ] Contract tests: each DTO decodes a real response from a local backend

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

- [ ] **Timer engine** in `core/data`: timer state is persisted locally as a start timestamp plus a duration, not as a ticking counter, so it survives process death. The web `ControlledTimer` keeps state in memory only, so this is new behaviour.
- [ ] **Ongoing timer notification**: a Chronometer notification with Stop / +30s actions. It uses a foreground service only while a timer is actually running.

Tasks:

- [ ] `widget` module: `GlanceAppWidget` + receiver per widget, `GlanceStateDefinition` backed by Room
- [ ] Widget configuration activities (habit picker) for W1 and W3
- [ ] `ActionCallback`s → `TrackerRepository.increment/toggle` → outbox. No network call inside the callback.
- [ ] Refresh triggers: after any tracker DAO change (via `WidgetUpdater`), periodic `SyncWorker` (15 min), **local-midnight rollover** (exact alarm or WorkManager at the next local midnight, so "today" resets on time), and on auth change
- [ ] Signed-out, empty, frozen and error states for every widget
- [ ] Widget previews (`previewLayout` / generated previews on Android 15+)
- [ ] Dark mode + dynamic color in widgets

**Exit:** W1 + W2 installed on a real device. Logging from the widget while offline appears on the web after reconnecting, with no duplicates. The widgets reset correctly at midnight.

### Phase 2 — Main features (Workstream D)

**Goal:** the app does everything the web app's daily-use screens do.

- [ ] **Tracker home** (`feature/tracker`): date selector, habit rows for each type (check, count stepper, timed with the notification timer, exercise → opens the session), progress and streak badges, anti-habit handling
- [ ] **Workout session** (`feature/session`): session panel, exercise log cards (compact + full, respecting `exerciseLogCardStyle`), set editor (reps/weight/duration/distance/RPE), unit system, exercise picker with **exercise sources** (lists, browse mode, catalog search, as described in [exercise-programs.md](exercise-programs.md)), and the Play/next behaviour
- [ ] **Analytics** (`feature/analytics`): habit heatmaps, volume / muscle / exercise charts (Vico), segmented control
- [ ] **Rest timer** (new, not on the web yet): after a set is logged, a rest countdown starts automatically. The default duration comes from a user setting, overridden by the list item's prescribed rest when the exercise came from a list with prescriptions. Controls: skip, +/−15s. It runs on the timer engine from Phase 1, so it shows in the ongoing notification, survives the app being backgrounded, and vibrates or sounds when it ends. Needs a `defaultRestSeconds` preference (backend: add it to `PATCH /api/me/preferences`).
- [ ] Session outbox ops: create session, add log, add, edit and delete a performance, all with idempotency keys
- [ ] Pull-to-refresh + sync indicator
- [ ] Error-code handling: frozen habit/exercise → snackbar with the same copy as the web (`errors:limits.*`)

**Exit:** a full workout can be logged in the app, and a day of habits can be tracked, with results identical to the web.

### Phase 3 — Settings & configuration (Workstream E)

**Goal:** a user never needs the web app.

- [ ] **Habits config**: list, create/edit form (type, anti-habit, goals, color theme or custom gradient, icon), reorder (drag), delete. Enforce the same Zod rules (mirrored in Kotlin validation) and the role limits (`GET /api/me/limits`).
- [ ] **Exercise library**: catalog browse/search by muscle group, create/edit/delete custom exercises, frozen state
- [ ] **Exercise lists**: CRUD, reorder items, add to list from the picker/library
- [ ] **Account**: locale (en/es), timezone, unit system, card style, preferred exercise source (`PATCH /api/me/preferences`), sign-out
- [ ] Remaining auth screens: sign-up (with invite code), forgot password, verify-email handling, Google sign-in
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

- The web app has namespaced JSON under [apps/frontend/src/i18n/locales](../../apps/frontend/src/i18n/locales) (en, es). Don't hand-copy strings. Add a small script (`apps/android/scripts/gen-strings`) that converts the JSON into `values/strings.xml` and `values-es/strings.xml`, prefixing keys with their namespace (`tracker_…`). It converts ICU placeholders to Android format args.
- Android-only strings (widget labels, notification actions) go in a separate hand-written `strings_android.xml`.
- The in-app locale switcher uses per-app language (`AppCompatDelegate.setApplicationLocales`) and PATCHes `/api/me/preferences`, just as the web does.

---

## 6. Risks & open issues

- **Type drift (D4).** Handwritten DTOs will drift from the backend. The contract tests catch it in CI until OpenAPI generation lands (Phase 4).
- **Widget freshness.** Android limits widget update frequency. Updates driven by user action are immediate. Changes made on the web appear only on the next sync (≤15 min) unless push is added later (FCM, backlog).
- **Timezone edge cases.** After A3 the server owns "today". The device timezone can still differ from the stored one while travelling. Proposal: when the device timezone changes, prompt the user and PATCH preferences.
- **Outbox conflicts.** Increments are commutative (A4). Absolute edits (set editor) use last-write-wins. That's acceptable for a single-user app, but document it.
- **Frozen items** must be enforced locally for UX (disable the widget tap). The server stays authoritative.
