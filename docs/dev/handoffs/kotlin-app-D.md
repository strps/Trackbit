# Handoff: Kotlin app — Workstream D (main features)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §2.2 and §4 "Phase 2". Core and widget context: the "Invariants" and "Landmines" sections of [kotlin-app-B.md](kotlin-app-B.md) and [kotlin-app-C.md](kotlin-app-C.md), nothing else.
- **Status:** Phase 2. D1 (tracker home) done on the emulator; D2 (session data layer) done (unit-tested, no UI yet); D3 next.
- **Branch:** `kotlin-app` · **Last run:** 2026-10-02 (D2; D1 and D2 uncommitted at the end of the run unless the user asked to commit)

## Where we are

The app's home is now the tracker (`feature/tracker`, `TrackerScreen`), replacing the C-era Today placeholder. It shows today or any past day, with a row for every habit type, progress and streak badges, an anti-habits section, frozen habits locked, pull-to-refresh and the pending-writes line. On the emulator (API 36, local backend): +1 and −1 on count habits, start/stop of a timed habit with a live time and the notification, the time edit dialog (0:45 reached the server as 45000 ms), going back a day, and picking May 26 in the date picker. That pulled history in two `/days` chunks and showed the server's values with a 2-day streak. "Go to today" and the workout placeholder screen work too. Not exercised on the emulator: check and anti-habit rows, a frozen habit, Spanish (this account has none of the first three). `./gradlew assembleDebug testDebugUnitTest lintDebug` passes with 0 lint issues and 221 tests (164 Android + 57 core:model; 19 new). The frontend type-checks (`tsc -b`).

## Phase 2 task split (D1–D6)

| Task | Scope | Status |
|---|---|---|
| **D1** | Tracker home: day bar + date picker (any past day), rows per type (check, count −/+, timed start/stop + time edit, complex → session route), badges, anti-habits, frozen, pull-to-refresh, frozen snackbar | ✅ 2026-10-02 |
| **D2** | Session data: Room entities for sessions/logs/performances + exercise catalog cache, `/history`-free reads, outbox ops (create session, add log, add/edit/delete performance) with idempotency keys (backend: add `idempotency` to those routes), contract tests | ✅ 2026-10-02 |
| **D3** | `feature/session`: session panel, log cards (compact/full per `exerciseLogCardStyle`), set editor (reps/weight/duration/distance/RPE), unit system. Replaces `SessionPlaceholderScreen` | next |
| **D4** | Exercise picker with sources (lists, browse, catalog search; [exercise-programs.md](../tasks/exercise-programs.md)), Play/next | |
| **D5** | Rest timer on the timer engine (`timers` rows with `habitId = null`), `defaultRestSeconds` preference (backend `PATCH /api/me/preferences`), end alert | |
| **D6** | `feature/analytics`: heatmaps, Vico charts, segmented control; then the Phase 2 exit check | |

The split is a proposal.

## Done (D1)

- **History per owner** (user decision: any past day). `history` is keyed by `HistoryOwner` (core:model: `Heatmap`, `Tracker`). Room v4 through a manual [Migrations.FROM_3_TO_4](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/Migrations.kt) (the v3 row becomes the heatmap's). `requestHistory(owner, start)` / `releaseHistory(owner)`. A new request inherits another owner's pull when that pull covers it and is fresh. `SyncDao.applyDays` records a pull only on requests that start inside it. `HistoryDao.release` keeps logs from the earliest remaining start (or the recent week), and clamps the remaining requests' `syncedStart` to that.
- **Chunked pulls:** `TrackerSync` pulls from the earliest start among the due requests, in chunks of `MAX_DAYS_PER_PULL` (371, the backend's limit), newest first. A failed chunk leaves the request due.
- **Past-day streaks:** `HabitDay.logsKnownFrom` (the recent week of the last `/today`, or the earliest pulled `syncedStart`, from a subselect in the same query). `Streak.endingBefore` walks back from the day while the logs are known (or before the first log). Otherwise it counts back from the server's `streakBeforeDay` when every day up to the summary counts. `observeDay(day, days)` takes a window; `STREAK_DAYS` = 366.
- **Tracker** ([feature/tracker](../../../apps/android/feature/tracker/src/main/kotlin/com/trackbit/feature/tracker)): `TrackerViewModel` (the picked past day lives in `SavedStateHandle`; null follows today across midnight). A past day reads `STREAK_DAYS` and requests history from `day − 365`; back on today it releases. Requests run off the display path behind a FIFO `Mutex`, after releasing any stale tracker request on start. `HabitRow` (accent block + icon, name, subtitle, badge line always reserved, type control), `TimeDialog` (`timeMs` validation), and `TrackerScreen` (day bar, `DatePickerDialog` limited to ≤ today, overflow menu with Log out).
- **Navigation:** `TrackerRoute` (was `TodayRoute`), `SessionRoute(habitId, day)` → `SessionPlaceholderScreen` in `app` until D3.
- **Strings:** the web tracker's hardcoded English moved to the locale JSON and the web now uses it: `tracker.{badge_*, check_*, count_completed, count_slips, sessions, no_sessions, mark_*, today, previous_day, next_day, go_to_today}`, `common.{cancel, save}` (CheckHabitRow, CountHabitRow, TimedHabitRow, ExerciseHabitRow, ProgressBadge, DateSelector). Android-only: `android_tracker_{decrement, choose_day, edit_time, time_title, minutes, seconds, open_session, more_options}`, `android_session_coming_soon`.
- **Icons:** `UI_ICONS` in `generate.mjs` → `ic_ui_*` (lucide, like the web), exposed as `UiIcons` in core:designsystem. 33 generated files.
- **Tests:** `StreakTest` (endingBefore), `HistoryTest` (per-owner recording, release clamp), migration 3→4, `HistorySyncTest` (chunks, failed chunk, two owners, past-day streak from pulled history), `TrackerRepositoryTest` (earlier day walks the week), `TrackerViewModelTest` (past day + history, midnight, restore, decrement floor, timers, `timeMs`).

## Done (D2)

**Backend** ([tracker.ts](../../../apps/backend/src/routes/app/tracker.ts), tests in [exercise-sessions.test.ts](../../../apps/backend/test/exercise-sessions.test.ts)):

- **Client uuids** (user decision; migration [0011](../../../apps/backend/drizzle/0011_exercise_uuids.sql), applied to the local dev DB only). `exercise_sessions`, `exercise_log` and `exercise_performances` have `uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE`. Creates take an optional `uuid`. A retry with the same uuid returns the first row; the same uuid under another parent → 409 `uuid_conflict`. Children name their parent by id or by uuid (`exerciseSessionUuid`, `exerciseLogUuid`, exactly one). New routes: `DELETE /exercise-{sessions,logs,performances}/uuid/:uuid` and `PATCH /exercise-performances/uuid/:uuid`. The web keeps using ids.
- **`POST /exercise-sessions` takes `{ habitId, day }`** (user decision) as well as `{ dayLogId }`, ensuring the day log first. **`GET /exercise-sessions?habitId&day`** (user decision): that day's sessions → `exerciseLogs` → `exercisePerformances`, oldest first.
- `Idempotency-Key` on all three creates.
- **Security fixes found on the way:**
  - The CRUD factory's create never ran `ownershipCheck`, so anyone could add sessions, logs or sets under another user's rows.
  - Its list returned **every user's** rows for tables without `userId`: day logs, sessions, logs, sets. Those lists are gone, and the factory now refuses to generate one.
  - `PATCH` could move a session, log or set under another user's parent. Session PATCH is gone, and the parent and exercise of logs and sets are immutable.
  - `id` was client-settable on set create.
  - A log could use another user's custom exercise.
- Creates and edits of sets now pass the same frozen gates as logs (habit and custom exercise). The owner checks are single join queries (`dayLogOwner`, `sessionOwner`, `exerciseLogOwner`, `performanceOwner`).
- **Web:** set edits now send only the editable fields. `PerformanceCard` spreads the whole set, which now includes `uuid`, and the strict PATCH schema would have rejected it.

**Android:**

- **Room v5** (auto-migration). `exercise_sessions` / `exercise_logs` / `exercise_performances` are keyed by uuid, with cascading FKs (sessions → habits). The `exercises` catalog has its last performance embedded.
- **Outbox:**
  - Op types `CreateSession`, `DeleteSession`, `CreateExerciseLog`, `DeleteExerciseLog`, `CreatePerformance`, `UpdatePerformance` and `DeletePerformance` carry their final wire body, keyed on the session's (habitId, day). That key is how the existing pending-op guard covers them.
  - A confirmed session op only leaves the outbox. A delete answered 404 counts as done.
  - A dropped create deletes its row (`TrackerSync.drop`), and the flush then re-pulls those days' sessions (`repairLocked`).
- **`SessionRepository`** (core:data): `observeSessions`, `observeExercises`, `refresh(habitId, day)` (flush + day pull + catalog), `startSession`, `deleteSession`, `addExercise`, `removeExercise`, `addSet` (number = count + 1, like the web), `updateSet`, `deleteSet`. Models: `TrackedSession`/`TrackedExerciseLog`/`TrackedSet`, `SetValues` (core:model). `WriteResult.ExerciseFrozen` is new.
- **`OutboxWriter`** holds the shared "optimistic change + op in one transaction" logic (the frozen and missing-habit checks, `extendFirstLogDay`); `DefaultTrackerRepository` uses it too.
- `ExerciseService` (`GET /api/exercise-info/exercises`).
- core:data applies the serialization plugin, for its own op payloads (`RowRef`, `SetUpdate`).
- **Contracts:** `exercise-sessions.json` is new. Session, log and set contracts are recorded with fixed client uuids.
- **Tests:** `SessionRepositoryTest` (9), `DecodeTest` (+2), migration 4→5.

## Next: D3 (session screen)

`feature/session` replaces `SessionPlaceholderScreen` (route `SessionRoute(habitId, day)`). Read the invariants below and the web's `features/activity-tracker` components (`ExerciseLogCard`, `ExerciseLogCardCompact`, `SetEditor`, `PerformanceCard`). Call `SessionRepository.refresh` on open and on pull-to-refresh. Defaults for a new set come from the web's `buildNewSetValues` (prescription, then last performance). The last performance is the newer of the catalog's `lastPerformance` and the latest local set. Frozen errors: snackbar with `errors:limits.*` copy (`HabitFrozen`, `ExerciseFrozen`).

## Invariants — do not break these

(Plus those in the B and C handoffs.)

- **History is per owner.** Never delete or overwrite another owner's request. Logs before the recent week exist only while some request covers them.
- **A pull is recorded only on requests that start inside it**, and chunks go newest first. `logsKnownFrom` relies on Room being fresh from a recorded `syncedStart` up to today.
- **A streak is null when the logs can't tell**; never guess from empty days before `logsKnownFrom`.
- **The tracker's shown day comes from `TrackerViewModel.days`** (clock + picked day), never `LocalDate.now()` in a composable. Writes use the row's `TrackedHabit.day`.
- **Timed totals are edited only while no timer runs.**
- **Session rows are named by client uuids**, chosen at creation and kept by the server. Never key a session, log or set by the server's `id` on Android.
- **Session ops are keyed on their session's (habitId, day)**, so one pending op shields the whole day (day log and sessions) from pulls. `SyncDao.applySessions` replaces a day only when nothing is pending for it.
- **Session writes go through `SessionRepository`** (with `OutboxWriter`), never DAOs directly.
- **Tracker strings that exist on the web come from the locale JSON** (regenerate with `pnpm android:generate`); only Android-specific ones go in `strings_android.xml`.

## Decisions made in D1

| Question | Decision | Why |
|---|---|---|
| How far back | Any day (user) | Parity with the web; history per owner keeps the heatmap and the tracker apart. |
| Frozen habits | Shown locked (user) | Same as the widgets; the web hides them. |
| Timed editing | Start/stop + a time dialog (user) | Parity with the web's editable timer. |
| Past-day streak | Request a year before the day; walk back, else count back from the summary | Exact like the web, and the recent week works offline. |
| When the tracker releases history | Back on today, and when a new screen starts | A request left when the app closes on a past day lingers (6-hourly pulls) until the next start; noted in the follow-ups. |
| Row height | Badge line always reserved | A first badge grew the row and moved the buttons under the finger (taps were lost on the emulator). |
| Workout rows | Navigate to `SessionRoute`; no `ensureDayLog` yet | D2/D3 decide how sessions attach. |

## Decisions made in D2

| Question | Decision | Why |
|---|---|---|
| Offline ids | Client uuids stored on the server (user, after first picking local ids + mapping) | One id before and after sync: no id mapping, no tombstones, ops carry final bodies. |
| Session reads | `GET /exercise-sessions?habitId&day` (user) | Sized for one screen; `/history` returns every habit. |
| Attaching a session | `{ habitId, day }` ensures the day log (user) | One op offline; the day log's id is never needed. |
| A refused create | Delete its row; children's ops fail (404) and drop; re-pull the day | Undoes the optimistic tree without guessing. |
| Delete answered 404 | Done | A retry after a lost response, or a row already deleted elsewhere. |
| Set number | Count of the log's sets + 1 | Same as the web. |

## Landmines

- **`HistoryOwner` lives in core:model** because `widget` and features can't see core:database.
- **The emulator user has no check or anti-habit.** Create one on the web (`localhost:5173`) to see those rows.
- **Production needs migration `0011`** (plus `0008`–`0010` and the `/days` backend). Old web builds keep working: ids still work and `uuid` is optional.
- **The PATCH schemas reject unknown keys** (400), including `uuid`. A client spreading a whole row into a PATCH breaks; send only the editable fields.
- **`GET /api/tracker/day-logs`, `/exercise-logs` and `/exercise-performances` no longer exist** (they leaked every user's rows). `GET /exercise-sessions` needs `habitId` and `day`.
- **Tapping by coordinates:** rows are about 230 px tall at 1080×2400; the day bar's ‹ is at (84, 294) and "go to today" at (996, 294).

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug --max-workers=2   # green, 0 lint issues, 233 tests (incl. core:model)
pnpm android:generate:check                                          # 33 generated files up to date
(cd apps/frontend && npx tsc -b)
pnpm --filter backend test                                           # 78 tests
```

## Open questions

- None blocking. Deferred items are in [kotlin-app-followups.md](../tasks/kotlin-app-followups.md).

## Run log

- 2026-10-02 — D1: Phase 2 split into D1–D6. History per owner (Room v4) with chunked pulls and past-day streaks; tracker home with a day picker, rows per type, badges, timers and a time dialog; web tracker strings moved to the locale JSON; lucide UI icons generated. Verified on the emulator against the local backend. Next: D2.
- 2026-10-02 — D2: client uuids on sessions, logs and sets (migration 0011, local dev only); `{ habitId, day }` session create and a day read; idempotency on creates. Fixed ownership holes on create, list and PATCH. Room v5, session outbox ops, `SessionRepository`, exercise catalog cache. Backend 78 tests, Android 233. Next: D3.
