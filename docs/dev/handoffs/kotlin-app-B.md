# Handoff: Kotlin app — Workstream B (Android core)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md) (read §1, §2 and the Phase 0 checklist in §4 only)
- **Status:** Phase 0: Workstream A (backend) is done; Workstream B has not started
- **Branch:** `kotlin-app` · **Last run:** 2026-09-24

## Where we are

All backend prerequisites (A1–A10) are shipped and covered by 38 Vitest tests. `apps/android/` does not exist yet. The next run starts B1 from an empty directory. The API contract the app talks to is the "As built" column of §3 of the plan. That column is authoritative. Do not use the older wording elsewhere in the plan.

## Done (Workstream A, for reference)

- Bearer auth: token in the `set-auth-token` header on sign-in — [auth.ts](../../../apps/backend/src/lib/auth.ts)
- Tracker writes, `/today` and `/history` — [tracker.ts](../../../apps/backend/src/routes/app/tracker.ts)
- Streak rules the Kotlin `Streak` helper must mirror — [streak.ts](../../../apps/backend/src/lib/streak.ts)
- Idempotency middleware — [idempotency.ts](../../../apps/backend/src/middleware/idempotency.ts)
- Shared icon ids, color themes and gradient stops — [habit-appearance.ts](../../../packages/types/src/habit-appearance.ts)
- Test harness and helpers (`signedInUser`, `createHabit`, `post`) — [apps/backend/test](../../../apps/backend/test)

## Next: B1 — Gradle skeleton + CI

1. Create `apps/android/` as a standalone Gradle project with:
   - `settings.gradle.kts`, `gradle/libs.versions.toml`, and a wrapper pinned to the current stable Gradle.
   - `build-logic/convention` with these plugins: `trackbit.android.application`, `trackbit.android.library`, `trackbit.android.compose`, `trackbit.hilt`, `trackbit.room`, `trackbit.jvm.library`.
2. Settings:
   - Use the latest stable Kotlin 2.x, AGP, Compose BOM, Hilt (KSP) and Room.
   - `compileSdk`/`targetSdk` 36, `minSdk` 26, JVM toolchain 21, `applicationId` `com.trackbit.app`.
3. Modules, per §2.1:
   - `app`, `core:{model,network,database,data,auth,designsystem,i18n}`, `feature:auth`, `widget`. Add other `feature:*` modules only when they are needed.
   - `core:model` is **pure JVM**, with no Android dependencies.
4. `app` module:
   - Hilt `Application`, `MainActivity` (Compose) and an empty nav host.
   - `BuildConfig.API_BASE_URL`: `http://10.0.2.2:3000/` in debug; in release, a Gradle property or env var.
   - A **debug-only** `network_security_config` permitting cleartext to `10.0.2.2` and `localhost`.
5. Repo wiring:
   - Root `package.json` scripts: `android:build`, `android:test`, `android:lint` (each `cd apps/android && ./gradlew …`) and `android:strings` (B9).
   - `.github/workflows/android.yml`, path-filtered to `apps/android/**`, `apps/frontend/src/i18n/locales/**` and `packages/types/**`. It runs setup-java 21 + the Gradle cache, then `assembleDebug testDebugUnitTest lintDebug`, and uploads the APK.
   - `apps/android/README.md` with setup steps.
6. Then B2 → (B3 ∥ B5 ∥ B8 ∥ B9) → B4 → B6 → B10. B7 comes after B2. The details are in the §4 checklist.

## Invariants — do not break these

- **Every tracker write sends `day`**, the local day the user is looking at. The only exception is widget or background writes meant for "today", which may omit it and let the server resolve today in the user's stored timezone. The server never takes a timestamp or `tz`.
- **Every outbox op carries an `Idempotency-Key`** generated once at enqueue and reused on every retry. Increments are commutative but not idempotent.
- **Displayed streak** = `dayCounts(today) ? streakBeforeDay + 1 : 0`:
  - `dayCounts` uses the local, optimistic value for today.
  - Anti-habits need `firstLogDay`: a day before it never counts, and `null` means no logs yet, so the streak is 0.
  - `complex` habits count sessions, not rating.
- A day log is identified by `(habitId, localDay)`, not by its server `id`. Room's `DayLogEntity` uses that composite key.
- Room is the only thing the UI and widgets read. The network writes into Room, and sync must not overwrite a row that still has pending outbox ops.
- Unknown enum values from the server (a new habit type or theme) must decode to an `Unknown` case, not crash.
- An icon id outside `HABIT_ICON_IDS` falls back to `star`, as on the web.

## Decisions made in the A run

| Question | Decision | Why |
|---|---|---|
| How is "one log per habit per day" enforced? | A stored `local_day` column + a unique index, backfilled with the user's tz (or America/Costa_Rica for `UTC` users) | The DB enforces it, so upserts are atomic and races are impossible |
| Where is the streak computed? | The server sends `streakBeforeDay`; clients add today | Widgets can update the streak optimistically while offline |
| Where do gradient presets and icon ids live? | `@trackbit/types`; the Android generator (B9) reads them | One source for three clients |

## Landmines

- **Migrations** have no `__drizzle_migrations` table. Apply them with `psql "$DATABASE_URL" -f apps/backend/drizzle/<file>.sql`, never with `db:migrate`. `0008` and `0009` are already applied to the local dev DB (a backup is in the session scratchpad, not the repo). **Production still needs `0008` and `0009`.** Run the audit query at the top of `0008` there first.
- **Backend tests** need `apps/backend/.env.test` (git-ignored) with `TEST_DATABASE_URL=…/trackbit_test`. Global setup **drops and recreates** the `public` schema of that DB. Never point it at the dev DB.
- **After `pnpm add` in any package, run `pnpm install` at the root.** Peer-hash changes can leave other packages' `node_modules` symlinks stale; `better-auth/react` stopped resolving in the frontend once.
- **After editing `packages/types`, rebuild it** with `pnpm --filter @trackbit/types build`. The backend and web import `dist/`.
- The emulator reaches the host backend at `10.0.2.2:3000`. The backend's CORS rules don't apply to native requests.
- The local machine has JDK 21 and an SDK at `~/Android/Sdk` (platform 36, build-tools 36.1, emulator). There is no `cmdline-tools` and no system Gradle, so bootstrap the wrapper with a pinned Gradle distribution.
- `pnpm lint` in `apps/frontend` already has ~40 errors. Compare counts before and after rather than expecting a clean run.

## Verify

```bash
pnpm --filter backend test                     # 38 passing
pnpm --filter backend exec tsc --noEmit -p .
(cd apps/frontend && npx tsc -b)
```

## Open questions

- Release `API_BASE_URL` (the production backend URL): assume a `TRACKBIT_API_URL` Gradle property, and flag it when setting up Play internal testing.
- The web tracker still uses the browser's timezone to pick "today" for its date selector, while widgets use the stored timezone. They only differ while travelling. The plan's §6 proposal (prompt and PATCH on a device timezone change) is not built yet. Assume that's fine for Phase 0.

## Run log

- 2026-09-24 — Workstream A (A0 Vitest harness + A1–A10) done. Next: B1.
