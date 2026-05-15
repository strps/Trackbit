# Trackbit — Native Android App (Kotlin) Implementation Plan

A comprehensive engineering plan for building a native Android client that mirrors the consumer-facing web frontend ([apps/frontend/](../../apps/frontend/)) and consumes the existing Hono backend ([apps/backend/](../../apps/backend/)).

The backend, schema, and API contract are **frozen for parity** in this plan: the Android app must conform to what the backend already exposes. Any backend change that the mobile client would require is called out explicitly as a "Backend coordination" item.

---

## 0. Goals & Non-goals

### Goals

- Native Android app, Kotlin-only, that delivers the full consumer experience of the web app:
  - Sign up / sign in / forgot password / verify email
  - Habit CRUD (count / complex / timed / check / anti-habit)
  - Activity tracker (day logs, exercise sessions, sets/performances, RPE)
  - Heatmap visualizations
  - Analytics + stats
  - Exercise library (read + custom)
  - Account settings: locale, timezone, password, email
  - Issue reporting
- Offline-first behavior: the user can log a habit completion without network and have it sync.
- Internationalization parity with the web app (`en`, `es`, with infrastructure for new locales).
- Design language consistent with web app's Shadcn/Radix-based UI but adapted to Material 3 conventions where they conflict.

### Non-goals (Phase-gated out)

- Admin dashboard ([apps/admin/](../../apps/admin/)) — desktop-only, not needed on mobile.
- E-invoicing / Hacienda v4.4 — not user-facing on mobile.
- Apple/iOS — separate project.
- Push notifications (deferred to a later phase; see [§13](#13-future-phases)).

---

## 1. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | Kotlin 2.x | Standard for native Android |
| Min SDK | 26 (Android 8.0) | Covers ~96% of devices, supports `java.time` natively |
| Target SDK | Latest stable (35+) | Play Store policy compliance |
| Build | Gradle (Kotlin DSL) + version catalog (`libs.versions.toml`) | Reproducible builds |
| UI | Jetpack Compose + Material 3 | Maps cleanly to the declarative React frontend |
| Navigation | `androidx.navigation:navigation-compose` (type-safe routes) | Mirrors React Router structure |
| DI | Hilt | Standard, low-friction |
| Async | Kotlin Coroutines + Flow | Non-negotiable for modern Android |
| HTTP | Ktor Client (OkHttp engine) | Native Kotlin, multiplatform-ready, plays well with cookie auth |
| Serialization | `kotlinx.serialization` | Matches Ktor, JSON-first |
| Local DB | Room (SQLite) | Offline cache + outbox |
| Key/Value | DataStore (Preferences + Proto) | Replaces SharedPreferences; stores locale/tz/session metadata |
| Image loading | Coil 3 | Compose-native |
| Date/time | `kotlinx-datetime` + `java.time` | Server stores tz-aware timestamps; client must respect user tz |
| Charts (heatmap, stats) | Vico (Compose charts) + custom Compose for the GitHub-style heatmap | No native equivalent; heatmap will be hand-rolled |
| Forms / validation | Compose state + a small Zod-equivalent (`konform` or hand-rolled) | Mirror the Zod schemas in [apps/backend/src/db/entitiesZodSchemas.ts](../../apps/backend/src/db/entitiesZodSchemas.ts) |
| Testing | JUnit5, Turbine, MockWebServer/Ktor MockEngine, Compose UI test, Paparazzi (screenshot) | Industry standard |
| Crash / analytics | (Decision deferred; see [§12](#12-open-questions)) | — |

> **Avoid**: Retrofit (Ktor handles it), Moshi (kotlinx-serialization handles it), RxJava (Flow handles it), Dagger (Hilt is the wrapper). Keeping the dep tree small.

---

## 2. Module Layout

Multi-module Gradle project. Each module is a clear seam with one responsibility — speeds incremental compilation and enforces architectural boundaries.

```
trackbit-android/
├── app/                              # Application module — DI graph, navigation host, theming
├── build-logic/                      # Convention plugins (kotlin, compose, hilt, room, ktor)
├── core/
│   ├── network/                      # Ktor client, auth interceptor, error mapping
│   ├── database/                     # Room database, DAOs, migrations
│   ├── datastore/                    # DataStore for session metadata + user prefs
│   ├── domain/                       # Pure-Kotlin domain models + repository interfaces
│   ├── designsystem/                 # Material 3 theme, color tokens, typography, custom components
│   ├── ui/                           # Shared Compose components (HabitCard, HeatmapCell, RpeSelector)
│   ├── i18n/                         # String resources + locale resolution helper
│   └── testing/                      # Test fixtures, fakes, MockEngine helpers
├── feature/
│   ├── auth/                         # SignIn, SignUp, ForgotPassword, VerifyEmail
│   ├── tracker/                      # TrackerHome — daily check-ins, day logs
│   ├── activity-tracker/             # Exercise sessions, sets, performances
│   ├── habits-config/                # Habit CRUD + reorder
│   ├── exercise-library/             # Browse + custom exercises
│   ├── analytics/                    # Heatmaps, stats
│   ├── account-settings/             # Locale, timezone, password, email
│   └── issues/                       # Bug-report submission
└── sync/                             # Background WorkManager workers (outbox flush, prefetch)
```

This layout intentionally mirrors [apps/frontend/src/features/](../../apps/frontend/src/features/), which makes feature-by-feature porting one-to-one.

---

## 3. API Contract & Networking

### 3.1 Base URL & environments

Three flavors — `dev`, `staging`, `prod` — each with its own `BACKEND_URL` injected via `BuildConfig` and Gradle product flavors. No URL ever hard-coded.

| Flavor | URL |
|--------|-----|
| dev | `http://10.0.2.2:3000` (emulator → host) / device LAN IP |
| staging | TBD |
| prod | TBD |

### 3.2 Endpoints (read-only mirror)

Source of truth: [apps/backend/src/index.ts](../../apps/backend/src/index.ts).

| Method+Path | Source | Notes |
|---|---|---|
| `POST /api/auth/sign-up/email` | Better-Auth | Body: `{ email, password, name, inviteCode? }` — invite code is now optional ([defbd66](../../apps/backend/src/lib/auth.ts)) |
| `POST /api/auth/sign-in/email` | Better-Auth | Sets session cookie |
| `POST /api/auth/sign-out` | Better-Auth | |
| `POST /api/auth/forget-password` | Better-Auth | |
| `POST /api/auth/reset-password` | Better-Auth | |
| `POST /api/auth/send-verification-email` | Better-Auth | |
| `GET /api/auth/get-session` | Better-Auth | Used to bootstrap on app start |
| `GET /api/habits` | [habits.ts:47](../../apps/backend/src/routes/app/habits.ts#L47) | Returns habits annotated with `frozen: boolean` |
| `POST /api/habits` | [habits.ts:62](../../apps/backend/src/routes/app/habits.ts#L62) | Returns 403 with `error: 'habit_limit_reached' \| 'habit_type_not_allowed'` |
| `PUT /api/habits/:id` | [habits.ts:127](../../apps/backend/src/routes/app/habits.ts#L127) | 403 `habit_frozen` if frozen |
| `PATCH /api/habits/reorder` | [habits.ts:195](../../apps/backend/src/routes/app/habits.ts#L195) | Batch order update |
| `DELETE /api/habits/:id` | [habits.ts:241](../../apps/backend/src/routes/app/habits.ts#L241) | |
| `GET /api/tracker/history?start=&end=&tz=` | [tracker.ts](../../apps/backend/src/routes/app/tracker.ts) | Habits + day logs, optionally filtered by local-date range |
| `POST /api/tracker/...` | [tracker.ts](../../apps/backend/src/routes/app/tracker.ts) | Day log + exercise session creation |
| `GET /api/exercise-info` | [exercise-info/](../../apps/backend/src/routes/app/exercise-info/) | Exercise library |
| `GET /api/config` | [config.ts](../../apps/backend/src/routes/app/config.ts) | App-wide config (signup-open flag, etc.) |
| `POST /api/issues` | [issues.ts](../../apps/backend/src/routes/app/issues.ts) | Bug reports |
| `GET /api/me/preferences`, `PATCH /api/me/preferences` | [preferences.ts](../../apps/backend/src/routes/app/preferences.ts) | Locale + timezone |

### 3.3 Auth strategy

The web client uses Better-Auth's session cookie. Mobile has two viable options:

1. **Cookie session (recommended for parity)** — Use a persistent `CookieJar` (OkHttp's `JavaNetCookieJar` backed by `PersistentCookieJar` or a Room-backed implementation). Pros: zero backend change, identical behavior. Cons: cookies are awkward to debug, must handle renewal.
2. **Bearer token** — Add a Better-Auth `bearer` plugin on the backend, store token in `EncryptedSharedPreferences`. Pros: cleaner mobile model. Cons: **requires backend coordination** (enable plugin, expose `/sign-in/email` token response).

→ **Decision: start with (1) cookie session.** Revisit if we hit cookie-jar bugs or want a more idiomatic mobile token flow.

**CORS note**: backend currently restricts `/api/*` to `process.env.FRONT_URL` ([index.ts:42](../../apps/backend/src/index.ts#L42)). Native Android does not send `Origin` like a browser, so CORS does not block it — but if we ever proxy through a webview, we'd need to add the mobile origin. **Backend coordination**: confirm no `Origin` enforcement beyond CORS preflight.

### 3.4 Network layer design

```
core/network/
  TrackbitClient.kt          # Single Ktor HttpClient instance (DI scoped @Singleton)
  AuthCookieJar.kt           # Room-backed cookie persistence
  ErrorMapping.kt            # HTTPException JSON → sealed class TrackbitError
  Interceptors/
    LocaleHeader.kt          # Sets Accept-Language from current i18n locale
    TimezoneHeader.kt        # Sets X-Timezone (or query param) from user prefs
    LoggingInterceptor.kt    # Debug-only, redacts cookies
```

Error contract: backend errors are JSON like `{ error: "habit_frozen", message: "..." }`. We model them as a sealed `TrackbitError` hierarchy so UI can branch on `error` codes (especially `habit_frozen`, `habit_limit_reached`, `habit_type_not_allowed`, `habit_order_conflict`, `custom_exercise_frozen`) — this is the same branching the web frontend still owes for the role-limits work tracked in [project_role_limits_freeze](../../.claude/projects/-home-cj-dev-Trackbit/memory/project_role_limits_freeze.md).

---

## 4. Local Persistence & Offline

### 4.1 Room schema

One Room database, mirroring the server-relevant subset. **Server is source of truth**; local DB is a cache + outbox.

Tables:
- `habits` — full mirror of server response, including the `frozen` flag.
- `day_logs` — habit completions.
- `exercise_sessions`, `exercise_logs`, `exercise_performances` — workout data.
- `exercise_info` — exercise library (rarely changes; refetched weekly).
- `pending_mutations` — outbox: each row is `{ id, kind, payloadJson, createdAt, attempts, lastError? }`.
- `user_preferences` — locale, timezone, role, name, email — refreshed on session bootstrap.

Migrations are versioned; each schema change ships a `Migration` and a Room schema export checked into git for review.

### 4.2 Offline write path (outbox pattern)

1. User taps "complete habit" → ViewModel calls repo.
2. Repo applies the change to Room **immediately** (optimistic).
3. Repo enqueues a `PendingMutation` row.
4. WorkManager `OutboxFlushWorker` runs (constraint: connected network), drains the queue oldest-first, calls the API, on success deletes the row and reconciles the server response.
5. On 4xx (other than 401) — surface error to user, **do not retry blindly**; remove from outbox and revert local state.
6. On 5xx / network — exponential backoff, capped at N retries, then surface a "couldn't sync" notification.

This mirrors the web's TanStack Query optimistic-mutation pattern, adapted for true offline.

### 4.3 Read path

- `Flow<List<Habit>>` from Room is the UI's source of truth.
- A `RemoteMediator`-style refresh runs on screen entry + manual pull-to-refresh.
- Tracker history uses paged queries by date range; we fetch one window (e.g. ±90 days from today) on app open, more on scroll.

---

## 5. Feature-by-feature plan

Each feature has: web source, screens, APIs, special considerations. Implementation order = order listed.

### 5.1 Auth ([apps/frontend/src/features/auth/](../../apps/frontend/src/features/auth/))

Screens: `SignInScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `VerifyEmailScreen`.

- Form validation: mirror Zod schemas.
- Invite code field is **optional** (per recent backend change [e3c5295](../../apps/backend/src/lib/auth.ts)).
- After sign-up, call `GET /api/me/preferences` and seed it from device locale + timezone (matches web Phase 2).
- VerifyEmail: deep link `trackbit://verify?token=...`. Configure `<intent-filter>` with `android:autoVerify="true"` and host an `assetlinks.json` on the production domain.

### 5.2 Habits configuration ([habits-configuration/](../../apps/frontend/src/features/habits-configuration/))

Screens: `HabitsListScreen`, `HabitConfigFormScreen` (create/edit), `IconPickerSheet`, `ColorThemePickerSheet`.

- Drag-to-reorder: use `androidx.compose.foundation` reorderable lists; on drop, send batched `PATCH /api/habits/reorder`.
- Frozen habits: render with reduced opacity + lock icon; tapping shows a bottom sheet explaining the role-limit freeze and pointing to "delete to free a slot."
- Color picker: implement gradient picker matching web `ColorThemeField` — preset themes + custom RGBA stops.

### 5.3 Tracker home ([tracker/](../../apps/frontend/src/features/tracker/))

Single screen, the most-used surface. Top of app's bottom-nav.

- Vertical list of habit cards, ordered by `order` then `createdAt`.
- Each card shows: icon, name, today's progress vs. `dailyGoal`, weekly progress dots, color gradient.
- Tap = quick log; long-press = open detail sheet with notes + rating.
- "Today" boundary respects user's stored timezone (DataStore).

### 5.4 Activity tracker ([activity-tracker/](../../apps/frontend/src/features/activity-tracker/))

Screens: `ExerciseSessionScreen`, `AddSetSheet`, `RpePicker`, `ExerciseSearchSheet`.

- Sets are typed: weight (kg/lb — preference), reps, RPE 1–10.
- Unit preference comes from `user_preferences` (see [§7](#7-preferences-locale--timezone)).
- Numeric input via custom Compose stepper (no system keyboard for reps; use a wheel picker for weight).

### 5.5 Exercise library ([exercise-library/](../../apps/frontend/src/features/exercise-library/))

- Searchable list, grouped by muscle group.
- Allow custom exercise creation (when role permits).
- Frozen custom exercises rendered like frozen habits.

### 5.6 Analytics ([analytics/](../../apps/frontend/src/features/analytics/))

- Heatmap: hand-rolled Compose canvas. Cells colored along the habit's gradient using its `colorStops`. Pinch-zoom + horizontal scroll. Tap a cell → detail bottom sheet.
- Stats: streaks, weekly avg, completion rate. Use Vico for line/bar charts.
- All time math goes through user timezone; no UTC midnight bugs.

### 5.7 Account settings ([AccountSettings.tsx](../../apps/frontend/src/features/auth/AccountSettings.tsx))

- Change name / email / password (Better-Auth endpoints).
- Locale switcher: the same set the web supports (`en`, `es`, optionally `en-XA` in debug builds). PATCH `/api/me/preferences`, then update in-process locale (`AppCompatDelegate.setApplicationLocales`).
- Timezone picker: `ZoneId.getAvailableZoneIds()` filtered + searchable.
- Sign out → clear cookie jar + DataStore + Room.

### 5.8 Issue reporting ([apps/backend/src/routes/app/issues.ts](../../apps/backend/src/routes/app/issues.ts))

- Floating "report" button in Account Settings.
- Capture device info (`Build.MODEL`, OS version, app version) and attach to the issue body.

---

## 6. Internationalization

The web app keeps i18n keys in JSON namespaces ([apps/frontend/src/i18n/](../../apps/frontend/src/i18n/)). Android does not benefit from sharing those JSONs directly — Android's resource system (string resources + `LocaleListCompat`) is the idiomatic path.

### 6.1 Approach

- Use Android's standard `res/values/strings.xml`, `values-es/strings.xml`.
- Generate these files from the existing JSON namespaces with a small Kotlin Gradle task (`generateStringResources`) so the source of truth stays the JSON files in [apps/frontend/src/i18n/locales/](../../apps/frontend/src/i18n/locales/). This avoids translation drift between web and mobile.
- Symbol convention: `tracker.empty_state` → `R.string.tracker_empty_state`.
- The generator MUST run as part of CI and fail on missing keys, mirroring `pnpm i18n:lint`.

### 6.2 Locale resolution

On app start: read `user_preferences.locale` from DataStore → call `AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(it))`. If unset, fall back to system locale, then PATCH preferences once we have a session.

### 6.3 Pseudo-locale

Available only in debug builds: when user picks "Pseudo (en-XA)" in account settings, swap locale to Android's built-in `en-XA` (Android Studio's pseudo-locale) — no JSON conversion needed; the system inflates strings.

---

## 7. Preferences, Locale & Timezone

Web stores `locale` + `timezone` in the user row and session ([project_i18n_phase2](../../.claude/projects/-home-cj-dev-Trackbit/memory/project_i18n_phase2.md)). Mobile must respect this same source.

Order of precedence at app boot:
1. Server preferences (`GET /api/me/preferences`) — authoritative once signed in.
2. DataStore cache — used while offline / before bootstrap completes.
3. Device defaults — used pre-signin.

The Tracker's "today" calculation uses preference timezone, not device timezone, so a user travelling across zones still sees their home day. This matches [tracker.ts](../../apps/backend/src/routes/app/tracker.ts) which accepts `tz` as a query param.

---

## 8. Design System Mapping

The web uses Shadcn (Radix primitives + Tailwind tokens). Material 3 is the Android equivalent, but with different conventions. Translation table:

| Web (Shadcn) | Android (Material 3) |
|---|---|
| `Button` variants (default/secondary/ghost/destructive) | `Button`, `FilledTonalButton`, `TextButton`, `Button(colors=error)` |
| `Card` | `Card` (Material 3) |
| `Dialog` | `AlertDialog` / `BasicAlertDialog` |
| `Sheet` (side drawer) | `ModalNavigationDrawer` |
| `BottomSheet` (mobile) | `ModalBottomSheet` |
| `Tabs` | `TabRow` / `PrimaryTabRow` |
| `DropdownMenu` | `DropdownMenu` (Compose) |
| `Toast` | `Snackbar` via `SnackbarHost` |
| Tailwind color tokens | `MaterialTheme.colorScheme` extended with Trackbit brand palette |

The brand palette + habit gradient stops carry over verbatim — they are domain data, not UI chrome.

Dark mode: follow system; expose override in account settings.

---

## 9. Build, CI & Quality

### 9.1 Local

- `./gradlew app:installDebug` — emulator/device install
- `./gradlew test` — unit tests
- `./gradlew connectedAndroidTest` — instrumented tests
- `./gradlew lint detekt ktlintCheck` — static analysis

### 9.2 CI (GitHub Actions, separate workflow under `.github/workflows/android.yml`)

Jobs (in parallel where possible):
1. **assemble** — `assembleDebug` + `assembleRelease` (unsigned)
2. **unit-test** — JVM tests with Robolectric where needed
3. **lint** — `lint`, `detekt`, `ktlintCheck`
4. **screenshot** — Paparazzi for design-system regressions
5. **i18n-parity** — runs the same JSON-key parity check as `pnpm i18n:lint`, plus verifies generated `strings.xml` matches

### 9.3 Release

- Signed AAB via `./gradlew bundleRelease`, signing config from CI secrets.
- Internal testing track first, then closed → open → production.
- Crashlytics or Sentry hookup (open question, [§12](#12-open-questions)).

---

## 10. Testing Strategy

| Layer | Tool | Scope |
|---|---|---|
| Pure logic (utils, domain) | JUnit5 + Kotest assertions | Date math, color interpolation, frozen-habit detection |
| ViewModels | Turbine + coroutines-test | StateFlow emissions, error mapping |
| Repositories | Ktor MockEngine + in-memory Room | Outbox flush correctness, optimistic updates |
| Compose UI | `createComposeRule()` | Per-screen behavior, accessibility semantics |
| Screenshots | Paparazzi | Design-system component snapshots |
| End-to-end | Maestro | Sign-in → create habit → log → see heatmap |

Acceptance: each feature ships with ViewModel tests + at least one Maestro flow; UI tests fill in critical interactions only.

---

## 11. Phased Delivery

Each phase ends with a buildable, installable APK that exercises the slice end-to-end against the existing backend.

### Phase 0 — Bootstrap (1 week)
- Project skeleton, version catalog, convention plugins.
- Hilt + Compose + Navigation wired.
- CI green on empty app.
- Decide: Crashlytics/Sentry, signing infra.

### Phase 1 — Auth + Session (1–2 weeks)
- Sign-in / sign-up / forgot / verify deep link.
- Cookie jar persistence, session bootstrap.
- Account settings stub (sign out only).
- Acceptance: can log in, restart app, still logged in.

### Phase 2 — Habits config (1–2 weeks)
- List + create + edit + delete + reorder.
- Frozen-habit UX.
- Color/icon pickers.
- Acceptance: matches the web habits page feature-for-feature.

### Phase 3 — Tracker home + day logs (2 weeks)
- Quick log, detail sheet, today view.
- Optimistic UI with Room cache (no outbox yet).
- Timezone-correct "today."
- Acceptance: can complete a habit and see weekly progress.

### Phase 4 — Offline outbox (1 week)
- WorkManager outbox + retry.
- Conflict reconciliation rules.
- Acceptance: airplane-mode taps survive a restart and sync on reconnect.

### Phase 5 — Activity tracker + exercise library (2 weeks)
- Sessions, sets, RPE, custom exercises.
- Exercise library browse + create.
- Acceptance: can log a workout end-to-end.

### Phase 6 — Analytics & heatmaps (1–2 weeks)
- Heatmap canvas with gradients.
- Stats screen.
- Acceptance: visual parity with web heatmaps.

### Phase 7 — Account settings full + issues + i18n (1 week)
- Locale + timezone switching.
- Password / email change.
- Issue reporting.
- Acceptance: i18n parity check passes.

### Phase 8 — Polish + Play Store release (1–2 weeks)
- Screenshot tests, Maestro flows.
- Store listing, screenshots, privacy policy URL.
- Internal → closed → open → production rollout.

Total: **~12–14 weeks** for a single engineer, less with parallelism on independent features.

---

## 12. Open Questions

These need an answer before or during Phase 0 — flagging now so they don't block later.

1. **Auth transport** — confirm cookie session is acceptable, or pre-emptively enable Better-Auth's `bearer` plugin on the backend?
2. **Crash reporting** — Crashlytics (Firebase) vs Sentry vs nothing for v1?
3. **Analytics events** — none yet on web; do we want product analytics on mobile (Amplitude / PostHog), or stay event-free?
4. **Push notifications** — Phase 8 or deferred? Determines whether we need FCM setup in Phase 0.
5. **Distribution** — Play Store only, or also F-Droid / direct APK?
6. **Backend CORS for native testing** — confirm the backend team is OK with us hitting `/api/*` from Android; no `Origin` checks beyond CORS.
7. **Heatmap performance** — can we get away with Compose `Canvas`, or do we need a `SurfaceView`/RenderScript path for very long histories?

---

## 13. Future Phases

Out of scope for v1 but worth holding space for:

- **Push notifications** — daily reminder to log, streak-at-risk warnings. Requires backend coordination (FCM tokens table, sending service).
- **Wear OS companion** — quick-log a habit from the wrist.
- **Widgets** — home-screen widget showing today's habits + tap-to-log.
- **Health Connect integration** — pull steps / workouts from Google Health Connect into Trackbit's exercise sessions.
- **Tablet / foldable layout** — two-pane tracker + analytics.
- **Biometric unlock** — re-auth with fingerprint after backgrounding.

---

## 14. Backend Coordination Items (summary)

These are the only items in this plan that may require touching [apps/backend/](../../apps/backend/). Most are discretionary:

| Item | Required? | Reason |
|---|---|---|
| Bearer token plugin for Better-Auth | Optional | Cleaner mobile auth than cookie jar |
| FCM tokens table + send service | Future | Push notifications |
| Confirm no `Origin` validation on `/api/*` | Required | Native clients don't send web-style `Origin` |
| Stable error-code contract documented | Recommended | Mobile branches on `error` field — needs to stay stable |
| New mobile-app version gate (`/api/config`) | Recommended | Lets us force-update or warn old clients |

---

## 15. Acceptance: "Done" definition for v1

- All consumer features from [apps/frontend/](../../apps/frontend/) have an Android counterpart.
- App passes i18n parity check for `en` and `es`.
- App is installable from internal Play Store track.
- Maestro smoke test passes: install → sign up → create habit → log → restart → sees data.
- Crash-free sessions ≥ 99% on 7-day rolling internal test.
- Cold start ≤ 2s on a Pixel 6.
