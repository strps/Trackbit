# Handoff: Kotlin app — Workstream D (main features)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §2.2 and §4 "Phase 2". Core and widget context: the "Invariants" and "Landmines" sections of [kotlin-app-B.md](kotlin-app-B.md) and [kotlin-app-C.md](kotlin-app-C.md), nothing else.
- **Status:** Phase 2. D1 (tracker home), D2 (session data layer), D3 (session screen) and D4 (picker sources, prescriptions, Play) done on the emulator; D5 next.
- **Branch:** `kotlin-app` · **Last run:** 2026-10-02 (D4; uncommitted at the end of the run unless the user asked to commit)

## Where we are

A workout habit's row on the tracker opens `feature/session` (`SessionScreen`) for that day: the day's sessions, their exercises as classic or compact cards, set editors, units, and at the foot of each session the **picker** (D4): a source dropdown ("All exercises" = browse mode, then the user's lists), a trigger naming what Play adds (tap for a bottom sheet with the queue or the searchable catalog), and Play. With a list selected, Play walks the list (the cursor is derived from the session's logs by list item); in browse mode it repeats the last pick, or else the last logged exercise. A set added to a log picked from a list starts from the list item's prescription.

On the emulator (API 36, local backend, the user's dev account, compact cards): picked the list "rstytersry" (the preference reached the server as `list:2`), pressed Play twice (Cardio with item 5, then Strenght with item 6), added a set to Strenght: it started at the prescribed 12 reps × 50 kg with RPE 8 from last time, and the server rows carry `list_item_id` 5 and 6. The sheet showed done entries dimmed and the cursor highlighted. Then switched back to "All exercises" (`preferred_exercise_source` became NULL again). **The account was restored**: the two test logs deleted and item 6's temporary prescription cleared. Not exercised: offline picker, a deleted list (dangling key), searching in the sheet, Spanish.

`./gradlew assembleDebug testDebugUnitTest lintDebug` passes with 0 lint issues and 273 tests.

The stash `stash@{0}` ("D2-only", from the half-split D1+D2 commit repaired by `996c4fc`) is redundant; drop it when the user agrees.

## Phase 2 task split (D1–D6)

| Task | Scope | Status |
|---|---|---|
| **D1** | Tracker home: day bar + date picker, rows per type, badges, anti-habits, frozen, pull-to-refresh | ✅ 2026-10-02 |
| **D2** | Session data: Room v5 entities + exercise catalog cache, session outbox ops keyed by client uuids, backend uuid/idempotency/ownership fixes, contracts | ✅ 2026-10-02 |
| **D3** | `feature/session`: session panel, log cards (classic/compact), set editor, units, catalog-search picker | ✅ 2026-10-02 |
| **D4** | Picker sources (lists, browse, preferred source), prescriptions as new-set defaults, Play/next | ✅ 2026-10-02 |
| **D5** | Rest timer on the timer engine (`timers` rows with `habitId = null`), `defaultRestSeconds` preference (backend `PATCH /api/me/preferences`), end alert | next |
| **D6** | `feature/analytics`: heatmaps, Vico charts, segmented control; then the Phase 2 exit check | |

## Done before D4 (committed)

- **D1:** history per `HistoryOwner` (Room v4), tracker home, web tracker strings in the locale JSON, lucide `UiIcons`.
- **D2:** client `uuid`s on sessions, logs and sets (backend migration 0011, local dev only); idempotent creates; `{ habitId, day }` session create; `GET /exercise-sessions?habitId&day`; Room v5; session outbox ops; `SessionRepository` + `OutboxWriter`.
- **D3:** `feature/session` ([module](../../../apps/android/feature/session/src/main/kotlin/com/trackbit/feature/session)): assisted Hilt `SessionViewModel`, `SessionScreen`, `ExerciseLogCards.kt`, `SetControls.kt` (steppers, RPE, screen-local stopwatch), `SessionFormat.kt` (kg ⇄ lbs); new-set defaults in `SessionRepository.addSet`; the outbox `send` fix; `DurationDialog` in core:designsystem; RPE names in the locale JSON.

## Done (D4)

- **Backend contracts** ([contracts.test.ts](../../../apps/backend/test/contracts.test.ts)): `exercise-sources.json`, `exercise-source.json`, `exercise-source-empty.json` (core:model) and `exercise-source-not-found.json` (core:network). No backend code changed.
- **core:model** ([ExerciseSource.kt](../../../apps/android/core/model/src/main/kotlin/com/trackbit/core/model/ExerciseSource.kt)): `ExerciseSourceDescriptor` (no `ref`: the app names sources only by `key` and never parses it), `SourceCapabilities`, `ResolvedQueue`, `QueueEntry`, `Prescription`, `QueueEmptyReason` (fallback `Unknown`); `queueDone` / `nextQueueIndex` (the web's cursor, ported with tests). `PreferredExerciseSourceRequest` always encodes the field, `null` included.
- **core:network:** `ExerciseService.sources()` / `source(key)`; `MeService.updatePreferredExerciseSource`.
- **core:auth:** `PreferencesRepository.setPreferredExerciseSource(key)` changes the cached `SessionUser` at once (`SessionStore.updateUser(ifToken) { … }`), then PATCHes in the auth scope (fire and forget, like the web).
- **core:database v6** (auto-migration 5→6, [SourceEntities.kt](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/entity/SourceEntities.kt)): `exercise_sources` (ordered by `ordinal`), `source_queues` (`gone` = the server answered 404), `queue_entries` (prescription embedded with prefix `rx_`, indexed by `listItemId`). `SourceDao` reads; `SyncDao.applySources` / `applyQueue` write (a source no longer listed takes its queue with it).
- **core:data:** `TrackerSync.syncSessions` now also pulls the sources; new `syncQueue(key)` (404 → `gone`). `SessionRepository` gained `observeSources`, `observeQueue` (→ `SourceQueue.Resolved | Gone`), `refreshQueue`. `addSet` puts the prescription first per field (`targetReps`, `targetWeight`, `targetDuration` s → ms, `targetDistance`; RPE only from the last performance), looked up by the log's `listItemId` in any cached queue.
- **feature/session:** `SessionViewModel` resolves `user.preferredExerciseSource` through the sources (browse mode if missing), observes and pulls the active queue (once per key change; pull-to-refresh pulls it again), and clears a dangling key only after **this screen's** sources pull answered `Done`. `ExercisePickerState.kt` (pure: browse vs source, cursor, done flags, search linking queued exercises to their first entry not done, Play's target), `ExercisePicker.kt` (`ExercisePickerBar`, `ExercisePickerSheet`). The D3 catalog-only sheet and `android_session_add_exercise` are gone.
- **Icons:** `UiIcons.ChevronDown`, `UiIcons.Layers` (`UI_ICONS` in `generate.mjs`).
- **Tests:** `ExerciseQueueTest` (6), `DecodeTest` +3 (incl. an unknown source kind), `EncodeTest` +1, `ErrorContractTest` +1, `AuthRepositoryTest` +2, `SourceDaoTest` (5), `MigrationTest` +1, `SessionRepositoryTest` +4, `SessionViewModelTest` +3, `ExercisePickerStateTest` (5).

## Next: D5 (rest timer)

1. Read the plan's "Rest timer" bullet (§4 Phase 2) and the C handoff's C3 decisions (timer engine, no foreground service, `TimerNotifier` in `app` follows Room).
2. Backend: add `defaultRestSeconds` to the user row (migration, local dev only), `PATCH /api/me/preferences` (Zod), the session's `additionalFields` in [auth.ts](../../../apps/backend/src/lib/auth.ts) and `@trackbit/types`; re-record `session.json`. Android: `SessionUser.defaultRestSeconds`, and a setter in `PreferencesRepository` (the settings screen is Phase 3; decide where D5 lets the user change it).
3. A rest timer is a `timers` row with `habitId = null`, `localDay = null` ([TimerEntity.kt](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/entity/TimerEntity.kt)); it needs a duration (or an end instant) column, so Room v7. Start it after a set is logged (decide what "logged" means on Android: adding a set? editing it?). Duration: the list item's `restSeconds` (`SourceDao.prescription(listItemId)`) else `defaultRestSeconds`. Controls: skip, ±15 s.
4. End alert: vibrate/sound when it ends with the app in the background. C3 chose no FGS; an exact alarm needs a permission on 13+. Pick the mechanism (e.g. `setExactAndAllowWhileIdle` with `USE_EXACT_ALARM`/`SCHEDULE_EXACT_ALARM`, or a countdown notification with `setTimeoutAfter` + `setWhen`) and note it in the decisions.

## Invariants — do not break these

(Plus those in the B and C handoffs.)

- **History is per owner.** Never delete or overwrite another owner's request. Logs before the recent week exist only while some request covers them.
- **A pull is recorded only on requests that start inside it**, and chunks go newest first. `logsKnownFrom` relies on Room being fresh from a recorded `syncedStart` up to today.
- **A streak is null when the logs can't tell**; never guess from empty days before `logsKnownFrom`.
- **The tracker's shown day comes from `TrackerViewModel.days`**, never `LocalDate.now()` in a composable. The session screen's day comes from its route.
- **Timed totals are edited only while no timer runs.** Likewise a lap's time can't be typed while its stopwatch runs.
- **Session rows are named by client uuids**, chosen at creation and kept by the server. Never key a session, log or set by the server's `id` on Android.
- **Session ops are keyed on their session's (habitId, day)**, so one pending op shields the whole day from pulls. `SyncDao.applySessions` replaces a day only when nothing is pending for it.
- **Session writes go through `SessionRepository`** (with `OutboxWriter`), never DAOs directly. **New-set defaults are decided there too** (`addSet`: prescription, then last performance), not in the UI.
- **No `x.also { suspendCall() }` (or other Unit-coerced lambdas) as an expression's value around suspend calls** in code whose result is used: write a block ending in the value.
- **Weights are stored in kg**; only the UI converts (`kgToDisplay`/`displayToKg`). Durations of sets are ms; prescriptions' durations are seconds.
- **Strings that exist on the web come from the locale JSON** (regenerate with `pnpm android:generate`); only Android-specific ones go in `strings_android.xml`.
- **A source is named only by its canonical `key`**; the app never parses it or branches on its kind. Branch on `capabilities`.
- **The queue cursor is derived from the session's logs** (`nextQueueIndex`), never stored. Logs picked from a queue entry carry its `listItemId`.
- **A preferred key is cleared only after this screen's own sources pull** says it's missing; Room's older copy may predate a new list. A key not (yet) in the sources is browse mode, not an error; so is a queue that answered 404.
- **Sources and queues are server data only** (nothing pending against them): they enter Room only through `SyncDao.applySources` / `applyQueue`, fenced like every pull.

## Decisions made in D4

| Question | Decision | Why |
|---|---|---|
| Decode `ref`? | No; `key` only | The key is canonical; a new source kind then needs no app change. |
| Sources/queues offline | Cached in Room (v6), pulled on screen open / pull-to-refresh / source change | Cheap, and prescriptions need the queue when a set is added offline. |
| Where prescriptions come from | Any cached queue entry with the log's `listItemId` | The web reads its lists cache the same way; no extra column on logs. |
| Preferred source write | Cached user first, then one PATCH (no outbox) | Web parity; an offline change reverting on the next session refresh is noted in the follow-ups. |
| Clearing `null` on the wire | A separate `PreferredExerciseSourceRequest` | `PreferencesRequest`'s "null = absent" can't say null; a dedicated body says it exactly. |
| Picker layout | Source dropdown, trigger (bottom sheet) and Play at the foot of each session | The web's layout; the popover becomes a sheet on a phone. |
| "No lists yet" hint | Disabled | The app has no list editor until Phase 3. |
| Add-to-list from the picker | Not built | Edits lists; Phase 3 (follow-ups). |
| Play on a frozen custom exercise | Disabled, rows locked | The server refuses it anyway. |

## Landmines

- **The emulator is signed in as the user's own dev account** (csrstrps@gmail.com, compact card style, preferred source NULL). Its list `rstytersry` (id 2) has Cardio (item 5), Strenght (item 6), otro 2 (item 7) and no prescriptions. To test prescriptions, set some on an item in the local DB and clear them afterwards, as D4 did.
- **Only a workout row's play button opens the session** (≈ (954, 1496) for "Ejercicio" at 1080×2400); the row itself doesn't.
- **The web's tables are singular in places:** `exercise_log` (not `exercise_logs`), `exercise_performances`, `exercise_list_items`.
- **Unit tests' fakes must suspend** (`yield()`), or bugs hide; `FakeExerciseService` now does.
- **The PATCH schemas reject unknown keys** (400), including `uuid`. Send only the editable fields.
- **`GET /api/tracker/day-logs`, `/exercise-logs` and `/exercise-performances` no longer exist.** `GET /exercise-sessions` needs `habitId` and `day`.
- **Production needs migrations `0008`–`0011`** and the `/days` backend.
- **`HistoryOwner` lives in core:model** because `widget` and features can't see core:database.

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug --max-workers=2   # green, 0 lint issues, 273 tests (incl. core:model)
pnpm android:generate:check                                          # 43 generated files up to date
(cd apps/frontend && npx tsc -b)
pnpm --filter backend test                                           # 78 tests
```

## Open questions

- None blocking. Deferred items are in [kotlin-app-followups.md](../tasks/kotlin-app-followups.md).

## Run log

- 2026-10-02 — D1: Phase 2 split into D1–D6. History per owner, tracker home, web tracker strings in the locale JSON, lucide UI icons. Next: D2.
- 2026-10-02 — D2: client uuids on sessions, logs and sets (migration 0011); `{ habitId, day }` session create and a day read; idempotent creates; ownership fixes. Room v5, session outbox ops, `SessionRepository`. Next: D3.
- 2026-10-02 — D3: repaired the half-split D1+D2 commit (`996c4fc`). `feature/session` (classic/compact cards, set editors, units, catalog picker); new-set defaults in `addSet`; fixed the session ops' `send` crash found on the emulator; RPE names in the locale JSON; `DurationDialog` shared. Android 244 tests. Next: D4.
- 2026-10-02 — D4: exercise sources (DTOs, contracts, Room v6 cache, `syncQueue`), preferred source via `PreferencesRepository`, prescriptions first in `addSet`, the picker (source dropdown, queue sheet, Play walking the queue). Android 273 tests. Next: D5.
