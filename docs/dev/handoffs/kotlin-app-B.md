# Handoff: Kotlin app — Workstream B (Android core)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §1, §2, §3 ("As built" column) and the Phase 0 checklist in §4.
- **Status:** Phase 0. Workstream A (backend) is done. Workstream B: B1–B6, B8 and B9 are done. Next is B10; B7 can go any time.
- **Branch:** `kotlin-app` · **Last run:** 2026-09-26

## Where we are

`apps/android/` builds. `./gradlew assembleDebug testDebugUnitTest lintDebug` passes with zero lint issues. These modules have code:

- `core:model`: DTOs, request bodies, fallback enums, `Streak`, `HabitProgress`, `colorAt`, and the generated `GradientPresets`.
- `core:network`: Retrofit services, interceptors, `ApiError` and `safeCall`.
- `core:database`: Room entities, DAOs, the `HabitDay` projection and the sync write.
- `core:designsystem`: the M3 theme from the web tokens, habit icons and color helpers.
- `core:i18n`: generated `strings.xml` (en, es).
- `core:auth`: `AuthRepository`, `AuthState`, the encrypted `SessionStore` and `SignOutHook`.
- `core:data`: `TrackerRepository` (reads + outbox writes), `TrackerSync` (flush/pull), `OutboxWorker`/`SyncWorker`, `PeriodicSync` and two sign-out hooks.

The unit tests total 129: 48 in model, 26 in network (MockWebServer), 15 in database (Robolectric), 20 in auth (plain JVM: real Tink, a temp-file DataStore and MockWebServer) and 20 in data (Robolectric, in-memory Room, a fake `TrackerService`, `work-testing`). `feature:auth` and `widget` are still empty stubs. The signed-out cold start was checked on the emulator (WorkManager initializes via Hilt, no crash); **the signed-in sync path has only run in unit tests**, because nothing can sign in until B10. The CI workflow has **not run on GitHub yet**, because nothing is pushed.

The API contract is the "As built" column of plan §3. That column is authoritative; do not use the older wording elsewhere in the plan.

## Done

- **Workstream A (backend):**
  - Bearer auth: [auth.ts](../../../apps/backend/src/lib/auth.ts)
  - Tracker writes, `/today`, `/history`: [tracker.ts](../../../apps/backend/src/routes/app/tracker.ts)
  - Streak rules: [streak.ts](../../../apps/backend/src/lib/streak.ts)
  - Idempotency: [idempotency.ts](../../../apps/backend/src/middleware/idempotency.ts)
  - Icon ids and themes: [habit-appearance.ts](../../../packages/types/src/habit-appearance.ts)
  - Test helpers: [apps/backend/test](../../../apps/backend/test)
- **B1 versions:** [libs.versions.toml](../../../apps/android/gradle/libs.versions.toml) pins Gradle 9.8.0 (wrapper with sha256), AGP 9.4.1, Kotlin 2.4.20, KSP 2.3.12, Hilt 2.60.1, Room 2.8.5 and Compose BOM 2026.09.00.
- **B1 convention plugins** are in [build-logic/convention](../../../apps/android/build-logic/convention/src/main/kotlin). Shared SDK and JVM settings are in [KotlinAndroid.kt](../../../apps/android/build-logic/convention/src/main/kotlin/com/trackbit/buildlogic/KotlinAndroid.kt).
- **B1 modules** are registered in [settings.gradle.kts](../../../apps/android/settings.gradle.kts). Other modules reference them through type-safe accessors, e.g. `projects.core.model`.
- **B1 `app`:**
  - [app/build.gradle.kts](../../../apps/android/app/build.gradle.kts) sets up BuildConfig `API_BASE_URL` and the release URL check.
  - The cleartext config is debug-only: [debug manifest](../../../apps/android/app/src/debug/AndroidManifest.xml).
- **B2 `core:model`** ([source](../../../apps/android/core/model/src/main/kotlin/com/trackbit/core/model)):
  - `TrackbitJson` (`ignoreUnknownKeys`; a null `day` is omitted because it equals its default).
  - `FallbackEnumSerializer` + `WireEnum`: `HabitType`, `ColorTheme`, `UnitSystem`, `ExerciseLogCardStyle` decode unknown strings to `Unknown`; `HabitIcon` falls back to `Star`. `wire` is the server string, so B5 can store it in Room.
  - `ColorStop` / `Rgba` decode `[r,g,b]` or `[r,g,b,a]`.
  - DTOs follow the real responses, not `@trackbit/types`: `Exercise` has `lastPerformance` and no `muscleGroup`; `frozen` defaults to `false` because create/update responses omit it.
  - `TrackableHabit` (type, isAntiHabit, dailyGoal) is implemented by `Habit` and `TodayHabit` and is what `Streak` and `HabitProgress` take.
  - Test fixtures in `core/model/src/test/resources/fixtures` are hand-built; B7 replaces them with recorded contracts.
- **B2 backend fixes:**
  - `dailyGoal` must be an integer ≥ 1 (Zod on create/update + CHECK `habits_daily_goal_positive`, migration `0010`). The web's `dailyGoal || 1` patches are gone and the habit form enforces `min(1)`.
  - `PUT /api/habits/:id` no longer resets `dailyGoal`/`weeklyGoal` to defaults when they are omitted.
  - `GET /api/exercise-info/exercises` `lastPerformance` is now scoped to the user's own logs (it leaked other users' sets on system exercises), and `distance`/`createdAt` are a number and ISO ([test](../../../apps/backend/test/exercise-last-performance.test.ts)).
- **B3 `core:network`** ([source](../../../apps/android/core/network/src/main/kotlin/com/trackbit/core/network)):
  - Services: `AuthService` (use the `signIn()` / `session()` extensions, not the raw methods), `TrackerService` (`today`, `check`, `increment`, `ensureDayLog`), `HabitsService` (list only), `MeService` (`limits`, `updatePreferences`).
  - Every tracker write takes a **required** `@Tag key: IdempotencyKey`, and `IdempotencyKeyInterceptor` turns it into the header. It is a plain class, not a value class, because Retrofit keys tags by Java type.
  - `SessionTokenSource` is the seam for B4. `currentToken()` is called on OkHttp threads, so it must return from memory. `onUnauthorized(rejectedToken)` fires only on a 401 to a request that carried a token.
  - `ApiError`: `Unauthorized(code, message)`, `HabitFrozen`, `CustomExerciseFrozen`, `NotFound`, `Validation(message, issues)`, **`RequestInProgress`** (409 `idempotency_request_in_progress`, the one 4xx to retry), `Server`, `Network`, `Unknown(status, code, message, cause)`. The mapping reads status first and the body tolerantly.
  - `get-session` returns 200 with a JSON `null` body for an invalid token (not 401), so `session()` returns `ApiResult<SessionResponse?>`.
  - `NetworkModule` needs `NetworkConfig` (provided by `app`'s `AppModule` from `BuildConfig`) and `SessionTokenSource` (bound by `core:auth`).
- **B5 `core:database`** ([source](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database), schema exported to `core/database/schemas/`, version 1):
  - `HabitEntity` implements `TrackableHabit`, so `Streak` and `HabitProgress` take it directly. `summaryDay` is the day `streakBeforeDay` is valid for.
  - `DayLogEntity(habitId, localDay, rating, sessionCount)`, PK `(habitId, localDay)`, FK cascade to habits. It stores no server id.
  - `OutboxEntity(type, habitId, localDay, payload JSON, idempotencyKey = UUID at construction, attempts)`. `localDay` is the Room row the op changed, even when the payload omits `day`.
  - `HabitDayDao.observeDay(day)` / `observeHabitDay(id, day)` → `HabitDay(habit, recent: 7 × RecentDay)`. It runs as one LEFT JOIN query, so habits and logs are always consistent.
  - `DayLogDao.setRating` / `addToRating` / `ensure` mirror the server upserts. `HabitDao.extendFirstLogDay` covers the B2 note about anti-habits.
  - `SyncDao.applyToday(TodayResponse)` is the only path sync writes through. It skips day logs with pending outbox ops, and keeps a pending habit's earlier local `firstLogDay`.
- **B4 `core:auth`** ([source](../../../apps/android/core/auth/src/main/kotlin/com/trackbit/core/auth)):
  - `AuthRepository` (`state`, `signIn`, `signOut`, `refresh`) is the public API; `AuthState` is `Loading` → `SignedOut` | `SignedIn(user)`.
  - `SessionStore` implements `SessionTokenSource`. It is separate from the repository because the OkHttp client needs the token source, and the repository needs `AuthService`, which needs the client; one class would be a DI cycle.
  - On disk: one typed DataStore file `session.enc` holding `StoredSession(token, user)`, encrypted as a whole by a Tink AES-256-GCM key whose keyset is wrapped by a Keystore master key. Token and user are always written together. A file that doesn't decrypt (lost key) is corruption → signed out.
  - `currentToken()` blocks only until the one startup read completes, then answers from a `@Volatile` field. This makes early requests (a worker in a cold process) send the token instead of going out unauthenticated.
  - Every change runs under one mutex. Changes after a network call are conditional on the token they started with (`clear(ifToken)`, `updateUser(ifToken)`), so a stale 401 or response can't undo a newer sign-in.
  - Sign-in: `signIn()` → `session(token)` with the new token passed explicitly; saved only if the server returns a user. Signing in as a different user runs the sign-out hooks first.
  - Sign-out: clears locally at once, then revokes on the server in the auth scope with the old token passed explicitly (offline, the session just expires).
  - `refresh()`: `null` or 401 → signed out, network/5xx → keep the cached session (offline boot), success → update the cached user. **Nothing calls it yet: B10 should call it when the app starts.**
  - **`SignOutHook`** (`@IntoSet`, declared with `@Multibinds`): runs before `SignedOut` is emitted and before another sign-in is saved, on sign-out, on a 401, and **at startup when there is no session**. So "signed out" always means "no cached data", even after a crash mid-sign-out. `core:data`'s `ClearDatabaseOnSignOut` runs `clearAllTables()` (outbox included).
- **B4 changes elsewhere:**
  - `AuthService.getSession` / `signOut` take an explicit `Authorization` header; `session(token = null)` checks a token that isn't the session's yet. `AuthInterceptor` sends a request that already has `Authorization` as is and doesn't report its 401.
  - Room is `api` in `trackbit.room` (the database class extends `RoomDatabase`; B6 needs `withTransaction`).
  - `android:allowBackup="false"`: the Keystore key never survives a restore, and everything else local is a server cache.
- **B6 `core:data`** ([source](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data)):
  - `TrackerRepository` is the public API: `observeDay(day)` / `observeHabit(id, day)` → `TrackedHabit` (habit fields, `recent`, `progress`, `streak: Int?`), `pendingWrites`, `setRating` / `increment` / `toggle` / `ensureDayLog` → `WriteResult` (`Queued`, `HabitFrozen`, `HabitNotFound`), and `refresh()` → `SyncResult` (`Done`, `Retry`, `Failed`, `SignedOut`) for pull-to-refresh.
  - A write is one `withTransaction`: frozen/missing check → optimistic DAO change → `extendFirstLogDay` → enqueue the op. Then `SyncScheduler.flushOutbox()`. Frozen habits are refused locally, so they never reach the server.
  - `toggle` sends an absolute `/check` (0 or 1), not an increment, so a replayed or reordered toggle can't flip it back.
  - Payload encode/decode for every `OutboxOpType` is in one file: [OutboxOps.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/sync/OutboxOps.kt). Ops always send `day`.
  - [TrackerSync.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/sync/TrackerSync.kt): `flush()` and `sync()` (flush, then `today(LocalDate.now())` → `applyToday`) run under one mutex. Flush is FIFO and stops at the first retryable op. `Network` → retry (never counted), `Server`/`RequestInProgress` → retry, counted, dropped after 10, `Unauthorized` → stop, anything else → drop. Any drop triggers a pull that undoes it.
  - Every Room write in `TrackerSync` is **fenced**: inside the transaction it checks `SessionTokenSource.currentToken()` still equals the token it started with. The session store forgets the token before the sign-out hooks clear Room, so a late response can never write the old user's data back. Hook order doesn't matter.
  - Confirmed ops go through the new `SyncDao.applyConfirmed(opId, log)`: delete the op, then store the server row (keeping `sessionCount`) only if no other op for that `(habitId, localDay)` is pending and the habit still exists.
  - WorkManager: `OutboxWorker` (unique `tracker-outbox`, `APPEND_OR_REPLACE`, needs network, exponential backoff) and a 15 min periodic `SyncWorker` (`KEEP`). `PeriodicSync.start()` (called from `TrackbitApplication.onCreate`) schedules it on every `SignedIn`. `CancelSyncOnSignOut` cancels all work tagged `tracker-sync`.
  - `app`: `TrackbitApplication` is a `Configuration.Provider` that takes `HiltWorkerFactory` from an `@EntryPoint`, not an injected field (a startup sign-out hook can initialize WorkManager during field injection). The manifest removes the default `WorkManagerInitializer`.
  - Streak staleness ([TrackedHabit.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/TrackedHabit.kt), `Streak.beforeDay` in `core:model`): for a day on or after `summaryDay`, the days in between are judged on local logs; `null` (unknown) if `summaryDay` is outside the 7-day window or after the displayed day. A day that doesn't count shows 0, as the invariant defines.
- **B6 changes elsewhere:** `android:dataExtractionRules` + `fullBackupContent` exclude everything. On Android 12+, `allowBackup="false"` no longer stops device-to-device transfer. Lint flagged this once WorkManager was added.
- **B8 `core:designsystem`**:
  - `TrackbitTheme` maps the generated `WebLight`/`WebDark` palettes onto M3 roles. Dynamic color still wins on Android 12+.
  - `HabitIcon.drawableRes` / `.painter()` give black stroked vectors; tint them.
  - `List<ColorStop>.colorAt(t)` returns a Compose `Color`. The math is in `core:model` (`colorAt` → `Rgba`), so Glance and tests can use it without Compose.
- **B9 generator** [scripts/generate.mjs](../../../apps/android/scripts/generate.mjs) (`pnpm android:generate[:check]`):
  - Outputs: strings, `GradientPresets.kt`, `WebColors.kt` and the 15 `ic_habit_*.xml`.
  - Fails on enum drift from `@trackbit/types`, locale asymmetry, key collisions, or ICU it can't express on Android.
  - The CI job `generated` runs the check. See the [README](../../../apps/android/README.md#generated-from-the-web-app).
- **B3/B9 fixes outside Android:**
  - Idempotency errors now return `{ error: <code>, message: <localized> }`, so clients can match `idempotency_request_in_progress` ([idempotency.ts](../../../apps/backend/src/middleware/idempotency.ts)).
  - Every route validates through `validator()` ([lib/validator.ts](../../../apps/backend/src/lib/validator.ts)), so every 400 is `{ message, errors }`. Before, 26 validators had no hook and answered `{ success: false, error: <ZodError> }`, which the web showed as "[object Object]". A test fails if a route imports `@hono/zod-validator` directly. The unused `crudRouter.ts` was deleted, and the admin limits hooks now show `message`.
  - The es `list.items_count` gained CLDR's `many` form ("1.000.000 de ejercicios"). Lint flagged it as missing, and the web needed it too.
- **B1 repo wiring:**
  - Root `pnpm android:build|test|lint` scripts
  - [android.yml](../../../.github/workflows/android.yml)
  - [README](../../../apps/android/README.md)

## Next: B10 (B7 any time)

The details are in the plan's §4 checklist. Notes for each:

- **B7:** when recording contracts, delete the hand-built fixtures and point `DecodeTest` at the recorded ones. Also record an idempotency 409/422 body and a validation 400 body.
- **B10:**
  - Strings come from `com.trackbit.core.i18n.R.string.auth_sign_in_*`. Error copy is under `errors_*`.
  - Route on `AuthRepository.state`: `Loading` → nothing (or splash), `SignedOut` → sign-in, `SignedIn` → Today. Call `refresh()` once when the app starts.
  - Sign-in errors: `Unauthorized(code = "INVALID_EMAIL_OR_PASSWORD")`, `Network`, and Better-Auth's 403 `EMAIL_NOT_VERIFIED` (arrives as `Unknown(403, "EMAIL_NOT_VERIFIED", …)`).
  - Today screen: `TrackerRepository.observeDay(LocalDate.now())`; +1 → `increment(id, day, 1)`, check → `toggle`; pull-to-refresh → `refresh()` (`Retry` = offline/server, show a hint; `SignedOut` = routing will follow). Show `WriteResult.HabitFrozen` with the `errors_limits_habit_frozen_*` strings. `streak == null` means "unknown until sync", so show no number. Also call `refresh()` when Today opens: nothing else pulls right after sign-in (the periodic sync can take 15 min).
  - Recompute "today" when the date changes while the screen is open (midnight). The repository takes the day as a parameter and never assumes it.
  - B10 is the first code to inject `AuthRepository` and the network services. The graph was checked once with a temporary injection this run; Dagger does not validate bindings nothing requests, even with `fullBindingGraphValidation`.

## Invariants — do not break these

- **Every tracker write sends `day`**, the local day the user is looking at. The server never takes a timestamp or `tz`. The API would allow omitting it for widget writes meant for "today", but `TrackerRepository` always sends it (see the B6 decisions).
- **Every outbox op carries an `Idempotency-Key`**, generated once at enqueue and reused on every retry.
- **Displayed streak** = `dayCounts(today) ? streakBeforeDay + 1 : 0`:
  - `dayCounts` uses the local, optimistic value for today.
  - Anti-habits need `firstLogDay`: a day before it never counts, and `null` means the streak is 0.
  - `complex` habits count sessions, not rating.
- A day log is keyed by `(habitId, localDay)`, never by its server `id`.
- Room is the only thing the UI and widgets read. Sync must not overwrite a row that still has pending outbox ops.
- Unknown server enum values decode to `Unknown` instead of crashing. An icon id outside `HABIT_ICON_IDS` falls back to `star`.
- **`core:model` has no Android dependencies.** It uses `trackbit.jvm.library`.
- **Module build files only apply plugins and declare dependencies.** Shared config (SDK levels, JVM 21, lint, test deps) belongs in `build-logic`, and versions belong in the catalog.
- **`feature/*` and `widget` never depend on each other.** Only `app` wires modules together.
- **Signed out ⇒ Room is empty.** Anything that caches per-user data registers a `SignOutHook`.
- **The session changes only through `SessionStore`**, and changes after a network call are conditional on the token they started with.
- **Tracker writes take a non-null `IdempotencyKey`.** Don't add a default value or an overload without one.
- **Server data enters tracker tables only through `SyncDao` (`applyToday`, `applyConfirmed`).** That is where the pending-op guard lives.
- **Tracker writes go through `TrackerRepository`**, never DAOs directly: it is what pairs the optimistic change with its outbox op in one transaction. `core:database` is `implementation` in `core:data` so features can't reach the DAOs.
- **Every Room write made after a network call is fenced on the session token** (`TrackerSync.fenced`). New sync code must do the same.
- **Sync runs under `TrackerSync`'s mutex.** A pull overlapping a flush could store a snapshot older than an op confirmed in between.
- **Generated files are never hand-edited.** They carry a "Generated by" header; change the source and run `pnpm android:generate`.

## Decisions made in B1

| Question | Decision | Why |
|---|---|---|
| compileSdk 36 (per the old handoff) or 37? | **compileSdk 37, targetSdk 36** | Compose 1.12 and Lifecycle 2.11 refuse to build against 36. Pinning old AndroidX would only hide that. targetSdk changes runtime behaviour, so raising it is a separate decision (plan D5 updated). |
| Kotlin plugin on Android modules | None. AGP 9's **built-in Kotlin** handles them. | `org.jetbrains.kotlin.android` is not applied under AGP 9. `KotlinBaseExtension.jvmToolchain(21)` configures it. |
| How do JVM modules join `testDebugUnitTest` / `lintDebug`? | `trackbit.jvm.library` registers alias tasks and applies `com.android.lint`. | One command covers every module. Without the aliases, JVM tests would silently not run in CI. |
| Release `API_BASE_URL` | `TRACKBIT_API_URL` Gradle property or env var. The `checkReleaseApiUrl` task fails before `generateReleaseBuildConfig` if it is missing. | A throwing provider breaks the configuration cache even when the URL is set, so the check runs as a task at execution time. |
| `android:strings` root script | Superseded: `android:generate` / `android:generate:check` run `apps/android/scripts/generate.mjs` | One generator covers strings, presets, colors and icons, because all four mirror web sources. |
| Launcher icon | An adaptive icon made from the web logo's mark (frame + pulse check, without the dot grid) | Fixes lint's `MissingApplicationIcon` warning. Replace it if a designed icon appears. |

## Decisions made in B3–B9

| Question | Decision | Why |
|---|---|---|
| How is `HabitType.Unknown` / `ColorTheme.Unknown` stored in Room? | By its constant name (`"Unknown"`). The column is NOT NULL. | Room makes columns of non-null properties NOT NULL. Wire strings are lowercase, so the name reads back through `fromWire` as the fallback. |
| Where does `colorAt` live? | Math in `core:model` (`Rgba`), with a Compose `Color` wrapper in designsystem | Glance and JVM tests can use it without Compose. |
| Where do gradient presets live? | `core:model` (`GradientPresets`), generated | They mirror `@trackbit/types`, which is `core:model`'s TypeScript twin. |
| How are Room DAOs tested? | Robolectric 4.17 + in-memory Room, JVM only | CI has no emulator. |
| `preferredExerciseSource` in `PreferencesRequest`? | Left out | Clearing it needs an explicit `null` on the wire, which the "null = absent" encoding can't express. Add a tri-state type in Phase 3. |
| `/api/tracker/history` service? | Not added | Phase 0 needs only `/today`. It needs its own nested DTOs (Phase 2 analytics). |

## Decisions made in B6

| Question | Decision | Why |
|---|---|---|
| How does sign-out stop a worker that is already running? | Cancel the work (hook) **and** fence every sync write on the token | Cancellation is cooperative: a worker holding a response can still commit after `clearAllTables()`. The fence can't lose that race. |
| Stale `streakBeforeDay` after midnight | Bridge from `summaryDay` with local logs; `null` only if unbridgeable | Offline widgets still get a streak as fresh as the logs they show. `null` is kept for real unknowns (a gap over 7 days, or a past day). |
| Which day does sync pull? | `today(LocalDate.now())`, the device's day | `summaryDay` then matches the day the app shows, so the streak needs no bridge right after a sync. |
| Server errors forever? | Drop after 10 counted 5xx/409, then resync | A poison op would otherwise block the FIFO for good. Network errors never count, because being offline for days is normal. |
| Omit `day` for widget writes? | No: every op sends `day` | The optimistic row and the server row stay the same. Phase 1 can revisit this if a widget really needs "server today". |
| On-demand `SyncWorker`? | Not built. `refresh()` runs in-process | No caller yet. Phase 1's midnight rollover can add a one-time sync request. |
| `WidgetUpdater` | Not built | Plan §2.2 has it watch the DAOs, so writes need no hook. Phase 1 adds it. |

## Decisions made in B4

| Question | Decision | Why |
|---|---|---|
| DataStore Preferences or typed DataStore? | **Typed** `DataStore<StoredSession?>` with an encrypting serializer (`androidx.datastore:datastore` 1.2.1) | Token and user are encrypted and written as one unit, so they can never disagree; no per-field encoding. |
| How does sign-in check the new token? | Pass it explicitly to `get-session`; the interceptor leaves an existing `Authorization` alone | The token is adopted only after the server confirms it. The alternative (set it in memory, then roll back) would briefly send an unconfirmed token with every request. |
| Who clears Room on sign-out? | A `SignOutHook` multibinding, implemented in `core:data` | `core:auth` can't see the database. Hooks also run at a signed-out startup, which makes "signed out ⇒ no cached data" an invariant rather than a step that a crash can skip. |
| Backups | `allowBackup="false"` | The Keystore key isn't restored, so a restored session file can't decrypt; all other local data is a server cache. |

## Landmines

- **Memory is tight (11 GB, and VS Code's Java server takes about 3 GB).** A build ended with exit 137 (killed) while stale Kotlin daemons were still alive. Run `./gradlew --stop` first, and use `--max-workers=2` if it happens again. Stop Gradle before booting the emulator. Start the emulator with `run_in_background`; a `nohup … &` in a foreground command gets killed.
- **No system Gradle.** Use `./gradlew` only. The first run downloads Gradle 9.8.0.
- **`local.properties` is git-ignored.** Locally it holds `sdk.dir=/home/cj/Android/Sdk`, and `ANDROID_HOME` is also set. AGP auto-installed platform `android-37.0` into that SDK.
- **The configuration cache is on.** In build scripts, never evaluate providers eagerly and never throw inside `providers.provider {}`. Capture providers into task actions instead (see `checkReleaseApiUrl`).
- `lintRelease`, `testReleaseUnitTest` and `assembleRelease` need `TRACKBIT_API_URL`. That is by design. CI runs only debug tasks.
- A `Configuration.setVisible` deprecation warning comes from AGP internals (`BasePlugin.createAndroidJdkImageConfiguration`), not from our code. Ignore it.
- The emulator previously had the discontinued Expo build of `com.trackbit.app` with a different signing key. It was uninstalled in this run. On another emulator or device, `INSTALL_FAILED_UPDATE_INCOMPATIBLE` means you should `adb uninstall com.trackbit.app`.
- **Backend migrations:** there is no `__drizzle_migrations` table, so apply them with `psql "$DATABASE_URL" -f apps/backend/drizzle/<file>.sql`. **Production still needs `0008`, `0009` and `0010`.** Run the audit queries at the top of `0008` and `0010` there first.
- **Backend tests** need `apps/backend/.env.test` (`TEST_DATABASE_URL=…/trackbit_test`). Setup **drops the `public` schema** of that database, so never point it at the dev database.
- After editing `packages/types`, run `pnpm --filter @trackbit/types build`. After `pnpm add`, run `pnpm install` at the root.
- **The generator reads `packages/types/dist`**, not `src`. `pnpm android:generate` builds the package first; calling `node apps/android/scripts/generate.mjs` directly does not.
- **Robolectric downloads `android-all` for SDK 36 on the first test run** (about 200 MB, cached in `~/.m2`). The first `:core:database:testDebugUnitTest` is slow.
- **SQLite on minSdk 26 is 3.18, with no `UPSERT` syntax.** Use Room's `@Upsert` (insert, then update) or a `@Transaction`, never `INSERT … ON CONFLICT DO UPDATE` in a `@Query`. Never use `OnConflictStrategy.REPLACE` on `habits`: REPLACE deletes the row, and the FK cascade would delete its day logs.

## Verify

```bash
pnpm android:build && pnpm android:test && pnpm android:lint   # all green, 0 lint issues, 129 unit tests
pnpm android:generate:check                                     # 19 generated files up to date
pnpm --filter backend test                                      # 46 passing
pnpm --filter backend exec tsc --noEmit -p .
```

## Open questions


- **Release `API_BASE_URL` (the production backend URL):** unknown. Supply it through `TRACKBIT_API_URL` when setting up Play internal testing. Release signing is not configured yet either.
- **Raising targetSdk to 37:** deferred. Review the Android 17 behaviour changes before doing it.
- **Timezones:** the web tracker picks "today" from the browser's timezone, while widgets use the stored timezone. The plan's §6 proposal isn't built. Assume that's fine for Phase 0.
- **CI:** the first GitHub run of `android.yml` is unverified. If the runner lacks platform 37, AGP should auto-install it, because the runner accepts the licenses. Check it on the first push.

## Run log

- 2026-09-24 — Workstream A (A0 Vitest harness + A1–A10) done. Next: B1.
- 2026-09-24 — B1 done: Gradle skeleton, convention plugins, module stubs, BuildConfig URL, debug cleartext config, launcher icon, pnpm scripts, CI workflow, README. Next: B2.
- 2026-09-26 — B2 done: `core:model` DTOs, fallback enums, Streak, HabitProgress (37 tests). Backend: dailyGoal ≥ 1 (migration 0010), PUT goal defaults, lastPerformance scoping and types. Next: B3 ∥ B5 ∥ B8 ∥ B9.
- 2026-09-26 — B3, B5, B8 and B9 done:
  - network: services, interceptors, ApiError (25 tests)
  - database: entities, DAOs, `HabitDay`, `SyncDao` (12 Robolectric tests)
  - designsystem: theme, icons, `colorAt`
  - `generate.mjs` + CI job
  - Backend: idempotency error codes, and one `validator()` for every route (46 tests). Web: es `many` plural.

  Next: B4 → B6 → B10.
- 2026-09-26 — B4 done: `core:auth` (encrypted session DataStore, `SessionStore`, `AuthRepository`, sign-out hooks, 20 tests), `ClearDatabaseOnSignOut` in `core:data`, explicit-token `get-session`/`sign-out`, Room as `api`, backups off. Next: B6 → B10.
- 2026-09-26 — B6 done: `core:data` (`TrackerRepository`, `TrackerSync` with session fence, `OutboxWorker`/`SyncWorker`, `PeriodicSync`, `CancelSyncOnSignOut`), `SyncDao.applyConfirmed`, `Streak.beforeDay`, WorkManager + Hilt in `app`, backup/transfer exclusion rules (29 new tests). Next: B10.
