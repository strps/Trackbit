# Handoff: Kotlin app — Workstream B (Android core)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §1, §2, §3 ("As built" column) and the Phase 0 checklist in §4.
- **Status:** Phase 0. Workstream A (backend) is done. Workstream B: B1 and B2 are done; B3, B5, B8 and B9 are next (in parallel).
- **Branch:** `kotlin-app` · **Last run:** 2026-09-26

## Where we are

`apps/android/` builds. `./gradlew assembleDebug testDebugUnitTest lintDebug` passes with zero lint issues. `core:model` has the DTOs, fallback enums, `Streak` and `HabitProgress`, with 37 JVM tests. The other module stubs are still empty, except `app` and `core:designsystem` (a placeholder `TrackbitTheme`). The CI workflow has **not run on GitHub yet**, because nothing is pushed.

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
- **B1 repo wiring:**
  - Root `pnpm android:build|test|lint` scripts
  - [android.yml](../../../.github/workflows/android.yml)
  - [README](../../../apps/android/README.md)

## Next: B3 ∥ B5 ∥ B8 ∥ B9, then B4 → B6 → B10

The details are in the plan's §4 checklist. B7 (contract tests) can start any time. Notes from B2 for them:

- **B3:** decode with `TrackbitJson` (Retrofit's kotlinx converter). Error bodies (`{ error, message, habitId }`) are not modelled yet; they belong with `ApiError`.
- **B5:** store enums by `wire`, and map unknown strings back through the same serializers so `Unknown`/`Star` stay consistent.
- **B6:** after an optimistic write to an anti-habit with no `firstLogDay`, set `firstLogDay` locally to that day. Otherwise `Streak.current` shows 0 until the next sync.
- **B7:** when recording contracts, delete the hand-built fixtures and point `DecodeTest` at the recorded ones.

## Invariants — do not break these

- **Every tracker write sends `day`**, the local day the user is looking at. The only exception is widget or background writes meant for "today", which may omit it. The server never takes a timestamp or `tz`.
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

## Decisions made in B1

| Question | Decision | Why |
|---|---|---|
| compileSdk 36 (per the old handoff) or 37? | **compileSdk 37, targetSdk 36** | Compose 1.12 and Lifecycle 2.11 refuse to build against 36. Pinning old AndroidX would only hide that. targetSdk changes runtime behaviour, so raising it is a separate decision (plan D5 updated). |
| Kotlin plugin on Android modules | None. AGP 9's **built-in Kotlin** handles them. | `org.jetbrains.kotlin.android` is not applied under AGP 9. `KotlinBaseExtension.jvmToolchain(21)` configures it. |
| How do JVM modules join `testDebugUnitTest` / `lintDebug`? | `trackbit.jvm.library` registers alias tasks and applies `com.android.lint`. | One command covers every module. Without the aliases, JVM tests would silently not run in CI. |
| Release `API_BASE_URL` | `TRACKBIT_API_URL` Gradle property or env var. The `checkReleaseApiUrl` task fails before `generateReleaseBuildConfig` if it is missing. | A throwing provider breaks the configuration cache even when the URL is set, so the check runs as a task at execution time. |
| `android:strings` root script | Not added yet | `scripts/gen-strings.mjs` arrives in B9. Add the script then. |
| Launcher icon | An adaptive icon made from the web logo's mark (frame + pulse check, without the dot grid) | Fixes lint's `MissingApplicationIcon` warning. Replace it if a designed icon appears. |

## Landmines

- **No system Gradle.** Use `./gradlew` only. The first run downloads Gradle 9.8.0.
- **`local.properties` is git-ignored.** Locally it holds `sdk.dir=/home/cj/Android/Sdk`, and `ANDROID_HOME` is also set. AGP auto-installed platform `android-37.0` into that SDK.
- **The configuration cache is on.** In build scripts, never evaluate providers eagerly and never throw inside `providers.provider {}`. Capture providers into task actions instead (see `checkReleaseApiUrl`).
- `lintRelease`, `testReleaseUnitTest` and `assembleRelease` need `TRACKBIT_API_URL`. That is by design. CI runs only debug tasks.
- A `Configuration.setVisible` deprecation warning comes from AGP internals (`BasePlugin.createAndroidJdkImageConfiguration`), not from our code. Ignore it.
- The emulator previously had the discontinued Expo build of `com.trackbit.app` with a different signing key. It was uninstalled in this run. On another emulator or device, `INSTALL_FAILED_UPDATE_INCOMPATIBLE` means you should `adb uninstall com.trackbit.app`.
- **Backend migrations:** there is no `__drizzle_migrations` table, so apply them with `psql "$DATABASE_URL" -f apps/backend/drizzle/<file>.sql`. **Production still needs `0008`, `0009` and `0010`.** Run the audit queries at the top of `0008` and `0010` there first.
- **Backend tests** need `apps/backend/.env.test` (`TEST_DATABASE_URL=…/trackbit_test`). Setup **drops the `public` schema** of that database, so never point it at the dev database.
- After editing `packages/types`, run `pnpm --filter @trackbit/types build`. After `pnpm add`, run `pnpm install` at the root.

## Verify

```bash
pnpm android:build && pnpm android:test && pnpm android:lint   # all green, 0 lint issues
pnpm --filter backend test                                      # 42 passing
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
