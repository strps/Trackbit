# Handoff: Kotlin app — Workstream D (main features)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §2.2 and §4 "Phase 2". Core and widget context: the "Invariants" and "Landmines" sections of [kotlin-app-B.md](kotlin-app-B.md) and [kotlin-app-C.md](kotlin-app-C.md), nothing else.
- **Status:** Phase 2. D1 (tracker home), D2 (session data layer) and D3 (session screen) done on the emulator; D4 next.
- **Branch:** `kotlin-app` · **Last run:** 2026-10-02 (D3; uncommitted at the end of the run unless the user asked to commit)

## Where we are

A workout habit's row on the tracker opens `feature/session` (`SessionScreen`) for that day. It lists the day's sessions with their exercises in the user's card style (classic or compact), with set editors for strength, cardio and flexibility, imperial or metric weights, and a catalog-search picker. On the emulator (API 36, local backend, the user's own dev account): started a session, added a strength exercise, added a set (it started at the catalog's last performance), stepped the weight and set an RPE in the compact sheet, then switched the account to classic, added a cardio exercise and ran a lap's stopwatch. Every row reached the server with the values shown. Not exercised: offline, frozen habit or exercise, imperial, flexibility, Spanish (listed in the follow-ups). `./gradlew assembleDebug testDebugUnitTest lintDebug` passes with 0 lint issues and 244 tests.

**The commit that was meant to hold D1+D2 (`ca757d4`) didn't build.** A second run was splitting D1 and D2 into separate commits while the first one committed. `996c4fc` adds what was missing (from that run's stash and backup). The stash `stash@{0}` ("D2-only") is now redundant; drop it when the user agrees.

## Phase 2 task split (D1–D6)

| Task | Scope | Status |
|---|---|---|
| **D1** | Tracker home: day bar + date picker, rows per type, badges, anti-habits, frozen, pull-to-refresh | ✅ 2026-10-02 |
| **D2** | Session data: Room v5 entities + exercise catalog cache, session outbox ops keyed by client uuids, backend uuid/idempotency/ownership fixes, contracts | ✅ 2026-10-02 |
| **D3** | `feature/session`: session panel, log cards (classic/compact), set editor, units, catalog-search picker | ✅ 2026-10-02 |
| **D4** | Picker sources (lists, browse, preferred source; [exercise-programs.md](../tasks/exercise-programs.md)), prescriptions as new-set defaults, Play/next | next |
| **D5** | Rest timer on the timer engine (`timers` rows with `habitId = null`), `defaultRestSeconds` preference (backend `PATCH /api/me/preferences`), end alert | |
| **D6** | `feature/analytics`: heatmaps, Vico charts, segmented control; then the Phase 2 exit check | |

## Done before D3 (committed)

- **D1:** history per `HistoryOwner` (Room v4), chunked `/days` pulls newest first, past-day streaks (`Streak.endingBefore`, `logsKnownFrom`); `TrackerScreen`/`TrackerViewModel` (picked day in `SavedStateHandle`); web tracker strings in the locale JSON; lucide `UiIcons`.
- **D2 backend** ([tracker.ts](../../../apps/backend/src/routes/app/tracker.ts), [exercise-sessions.test.ts](../../../apps/backend/test/exercise-sessions.test.ts)): client `uuid`s on sessions, logs and sets (migration 0011, local dev only); idempotent creates by uuid + `Idempotency-Key`; parents by id or uuid; `DELETE …/uuid/:uuid`, `PATCH /exercise-performances/uuid/:uuid`; `POST /exercise-sessions` with `{ habitId, day }`; `GET /exercise-sessions?habitId&day`. Ownership holes fixed in the CRUD factory (create, list, PATCH).
- **D2 Android:** Room v5 (sessions/logs/sets by uuid, `exercises` catalog with its last performance); session outbox ops; a refused create deletes its row and the day is re-pulled; `SessionRepository` + `OutboxWriter`; `ExerciseService`.

## Done (D3)

- **`feature/session`** ([module](../../../apps/android/feature/session/src/main/kotlin/com/trackbit/feature/session)):
  - `SessionViewModel` is an assisted Hilt VM (`habitId`, `day` from `SessionRoute` via `toRoute`). It combines `TrackerRepository.observeHabit` (name, frozen), `SessionRepository.observeSessions`/`observeExercises` and the signed-in user's `unitSystem`/`exerciseLogCardStyle` (Unknown → metric/classic). It refreshes on open and on pull-to-refresh. `WriteResult.HabitFrozen`/`ExerciseFrozen` → snackbar with `errors:limits.*` copy.
  - `SessionScreen`: the empty state starts a session; `SessionPanel` (delete in the menu, "Add exercise"); `ExercisePickerSheet` (catalog search; frozen custom exercises locked). A frozen habit shows the `limits` banner and no controls; a frozen custom exercise's log has no controls.
  - `ExerciseLogCards.kt`: `ExerciseLogCard` (classic: summary, Start/Finish opens one card per set plus "New set", "delete selected set" in the menu) and `ExerciseLogCardCompact` (set columns open a bottom-sheet editor with delete; "+" adds a set and opens it). Flexibility shows one hold.
  - `SetControls.kt`: `SetEditor` (strength: reps, weight, RPE; cardio: stopwatch, distance, RPE; flexibility: stopwatch, RPE), `NumberStepper` (−/typed/+, applied on Done or focus loss), `RpeSelector` (10 pips; tapping the chosen one clears it), `Stopwatch` (screen-local, saves on pause; tap the time to type it).
  - `SessionFormat.kt`: kg ⇄ lbs like the web's `intlFormatter`, `averageRpe`, `rpeColor`, `ExerciseKind` from `category`.
- **New-set defaults in core:data:** `SessionRepository.addSet(logId)` takes no values. It starts from the newer of the exercise's latest set in Room (`SessionDao.latestSet`) and the catalog's `lastPerformance`, else empty. D4 adds the prescription in front of that.
- **Outbox bug fixed** ([OutboxOps.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/sync/OutboxOps.kt) `send`): session branches were `null.also { call() }`. Once Retrofit really suspended, the call's result escaped as `send`'s value and `applyConfirmed` threw `ClassCastException` (`ExerciseSession` → `DayLog`), so the outbox stuck after the first session op. Branches are now blocks ending in `null`. `FakeTrackerService`'s session calls `yield()`, which makes 4 `SessionRepositoryTest`s fail on the old code.
- **Shared pieces:** `DurationDialog` + `timeMs` moved from feature/tracker's `TimeDialog` to core:designsystem (which now depends on core:i18n). New `UiIcons`: Clock, Dumbbell, Hash, MapPin, Pause, Scale, Search, Trash (`UI_ICONS` in `generate.mjs`; `UiIcons.kt` is handwritten).
- **Strings:** RPE level names moved from the web's hardcoded `RPE_LABELS` to `tracker.rpe_level_{1..10}` (en/es); the web reads them through [use-rpe-label.ts](../../../apps/frontend/src/hooks/use-rpe-label.ts). Android-only: `android_session_{back, add_exercise, increase, decrease, start_stopwatch, pause_stopwatch, edit_time, rpe_level}`. `android_session_coming_soon` and `SessionPlaceholderScreen` are gone.
- **Tests:** `SessionViewModelTest` (6), `SessionFormatTest` (4), `SessionRepositoryTest` +1 (new-set defaults), `DurationDialogTest` (moved from `TrackerViewModelTest`).

## Next: D4 (picker sources, prescriptions, Play/next)

1. Read [exercise-programs.md](../tasks/exercise-programs.md) §"The `ExerciseSource` abstraction" and §"Endpoints" only, then the web's [AddExercisePicker.tsx](../../../apps/frontend/src/features/activity-tracker/components/AddExercisePicker.tsx), [use-exercise-sources.ts](../../../apps/frontend/src/hooks/use-exercise-sources.ts) (`GET /exercise-sources`) and [use-exercise-queue.ts](../../../apps/frontend/src/hooks/use-exercise-queue.ts) (`GET /exercise-sources/:key`, client-side cursor).
2. Add DTOs + contract tests for those endpoints, and a cache for sources/queues (config-like data: online-required is acceptable per plan D3, but the picker must still work offline from the last copy if cheap).
3. Pass `listItemId` through `SessionRepository.addExercise` (it already takes it) and put the prescription first in `addSet`'s defaults (`targetReps`, `targetWeight`, `targetDuration` in seconds → ms, `targetDistance`; RPE never comes from a prescription — see `buildNewSetValues` in `useActivityTracker.ts`).
4. Replace `ExercisePickerSheet` in [SessionScreen.kt](../../../apps/android/feature/session/src/main/kotlin/com/trackbit/feature/session/SessionScreen.kt) with the source dropdown + "Add next from {source}" / "Add {name}", and the preferred source (`preferredExerciseSource`, `PATCH /api/me/preferences`).

## Invariants — do not break these

(Plus those in the B and C handoffs.)

- **History is per owner.** Never delete or overwrite another owner's request. Logs before the recent week exist only while some request covers them.
- **A pull is recorded only on requests that start inside it**, and chunks go newest first. `logsKnownFrom` relies on Room being fresh from a recorded `syncedStart` up to today.
- **A streak is null when the logs can't tell**; never guess from empty days before `logsKnownFrom`.
- **The tracker's shown day comes from `TrackerViewModel.days`**, never `LocalDate.now()` in a composable. The session screen's day comes from its route.
- **Timed totals are edited only while no timer runs.** Likewise a lap's time can't be typed while its stopwatch runs.
- **Session rows are named by client uuids**, chosen at creation and kept by the server. Never key a session, log or set by the server's `id` on Android.
- **Session ops are keyed on their session's (habitId, day)**, so one pending op shields the whole day from pulls. `SyncDao.applySessions` replaces a day only when nothing is pending for it.
- **Session writes go through `SessionRepository`** (with `OutboxWriter`), never DAOs directly. **New-set defaults are decided there too** (`addSet`), not in the UI.
- **No `x.also { suspendCall() }` (or other Unit-coerced lambdas) as an expression's value around suspend calls** in code whose result is used: write a block ending in the value.
- **Weights are stored in kg**; only the UI converts (`kgToDisplay`/`displayToKg`). Durations of sets are ms.
- **Strings that exist on the web come from the locale JSON** (regenerate with `pnpm android:generate`); only Android-specific ones go in `strings_android.xml`.

## Decisions made in D3

| Question | Decision | Why |
|---|---|---|
| Picker in D3 | Catalog search only; sources are D4 | The screen needed a way to add exercises to be usable and verified. |
| Where new-set defaults live | `SessionRepository.addSet(logId)` | One rule for every caller; D4's prescription slots in there. |
| "Last performance" | Newer of Room's latest set and the catalog's | The catalog is stale until a refresh; a set just logged here wins. |
| Lap/hold timer | Screen-local stopwatch, saved on pause | Web parity; timer-engine version noted in the follow-ups. |
| Flexibility with no hold | "Start" adds the hold | The web has no way to start one; noted in the follow-ups. |
| Compact set editor | Bottom sheet | The web's popover doesn't fit a phone. |
| VM arguments | Assisted Hilt VM from `toRoute` | Typed; no string keys into `SavedStateHandle` across modules. |
| RPE names | Moved to the locale JSON, used by the web | Same rule as D1's tracker strings; they had no translation. |

## Landmines

- **The emulator is signed in as the user's own dev account** (csrstrps@gmail.com, compact card style). D3 flipped it to classic for a check and back; leave it compact. Its catalog has four custom exercises (Cardio, otro 1, otro 2, Strenght) and no flexibility one.
- **Only a workout row's play button opens the session** (≈ (954, 1496) for "Ejercicio" at 1080×2400); the row itself doesn't.
- **Unit tests' fakes didn't suspend**, which hid the `send` bug. Fakes standing in for Retrofit should `yield()`.
- **The PATCH schemas reject unknown keys** (400), including `uuid`. Send only the editable fields.
- **`GET /api/tracker/day-logs`, `/exercise-logs` and `/exercise-performances` no longer exist.** `GET /exercise-sessions` needs `habitId` and `day`.
- **Production needs migrations `0008`–`0011`** and the `/days` backend.
- **`HistoryOwner` lives in core:model** because `widget` and features can't see core:database.

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug --max-workers=2   # green, 0 lint issues, 244 tests (incl. core:model)
pnpm android:generate:check                                          # 41 generated files up to date
(cd apps/frontend && npx tsc -b)
pnpm --filter backend test                                           # 78 tests
```

## Open questions

- None blocking. Deferred items are in [kotlin-app-followups.md](../tasks/kotlin-app-followups.md).

## Run log

- 2026-10-02 — D1: Phase 2 split into D1–D6. History per owner, tracker home, web tracker strings in the locale JSON, lucide UI icons. Next: D2.
- 2026-10-02 — D2: client uuids on sessions, logs and sets (migration 0011); `{ habitId, day }` session create and a day read; idempotent creates; ownership fixes. Room v5, session outbox ops, `SessionRepository`. Next: D3.
- 2026-10-02 — D3: repaired the half-split D1+D2 commit (`996c4fc`). `feature/session` (classic/compact cards, set editors, units, catalog picker); new-set defaults in `addSet`; fixed the session ops' `send` crash found on the emulator; RPE names in the locale JSON; `DurationDialog` shared. Android 244 tests. Next: D4.
