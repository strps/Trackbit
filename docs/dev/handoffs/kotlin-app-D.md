# Handoff: Kotlin app — Workstream D (main features)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §2.2 and §4 "Phase 2". Core and widget context: the "Invariants" and "Landmines" sections of [kotlin-app-B.md](kotlin-app-B.md) and [kotlin-app-C.md](kotlin-app-C.md), nothing else.
- **Status:** Phase 2. D1 (tracker home) done on the emulator; D2 next.
- **Branch:** `kotlin-app` · **Last run:** 2026-10-02 (D1; uncommitted at the end of the run unless the user asked to commit)

## Where we are

The app's home is now the tracker (`feature/tracker`, `TrackerScreen`), replacing the C-era Today placeholder. It shows today or any past day, with a row for every habit type, progress and streak badges, an anti-habits section, frozen habits locked, pull-to-refresh and the pending-writes line. On the emulator (API 36, local backend): +1 and −1 on count habits, start/stop of a timed habit with a live time and the notification, the time edit dialog (0:45 reached the server as 45000 ms), going back a day, and picking May 26 in the date picker. That pulled history in two `/days` chunks and showed the server's values with a 2-day streak. "Go to today" and the workout placeholder screen work too. Not exercised on the emulator: check and anti-habit rows, a frozen habit, Spanish (this account has none of the first three). `./gradlew assembleDebug testDebugUnitTest lintDebug` passes with 0 lint issues and 221 tests (164 Android + 57 core:model; 19 new). The frontend type-checks (`tsc -b`).

## Phase 2 task split (D1–D6)

| Task | Scope | Status |
|---|---|---|
| **D1** | Tracker home: day bar + date picker (any past day), rows per type (check, count −/+, timed start/stop + time edit, complex → session route), badges, anti-habits, frozen, pull-to-refresh, frozen snackbar | ✅ 2026-10-02 |
| **D2** | Session data: Room entities for sessions/logs/performances + exercise catalog cache, `/history`-free reads, outbox ops (create session, add log, add/edit/delete performance) with idempotency keys (backend: add `idempotency` to those routes), contract tests | next |
| **D3** | `feature/session`: session panel, log cards (compact/full per `exerciseLogCardStyle`), set editor (reps/weight/duration/distance/RPE), unit system. Replaces `SessionPlaceholderScreen` | |
| **D4** | Exercise picker with sources (lists, browse, catalog search; [exercise-programs.md](../tasks/exercise-programs.md)), Play/next | |
| **D5** | Rest timer on the timer engine (`timers` rows with `habitId = null`), `defaultRestSeconds` preference (backend `PATCH /api/me/preferences`), end alert | |
| **D6** | `feature/analytics`: heatmaps, Vico charts, segmented control; then the Phase 2 exit check | |

The split is a proposal: D2 may need splitting once the session API is read (`apps/backend/src/routes/app/` exercise session routes and `use-tracker.ts`'s session mutations on the web).

## Done (D1)

- **History per owner** (user decision: any past day). `history` is keyed by `HistoryOwner` (core:model: `Heatmap`, `Tracker`). Room v4 through a manual [Migrations.FROM_3_TO_4](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/Migrations.kt) (the v3 row becomes the heatmap's). `requestHistory(owner, start)` / `releaseHistory(owner)`. A new request inherits another owner's pull when that pull covers it and is fresh. `SyncDao.applyDays` records a pull only on requests that start inside it. `HistoryDao.release` keeps logs from the earliest remaining start (or the recent week), and clamps the remaining requests' `syncedStart` to that.
- **Chunked pulls:** `TrackerSync` pulls from the earliest start among the due requests, in chunks of `MAX_DAYS_PER_PULL` (371, the backend's limit), newest first. A failed chunk leaves the request due.
- **Past-day streaks:** `HabitDay.logsKnownFrom` (the recent week of the last `/today`, or the earliest pulled `syncedStart`, from a subselect in the same query). `Streak.endingBefore` walks back from the day while the logs are known (or before the first log). Otherwise it counts back from the server's `streakBeforeDay` when every day up to the summary counts. `observeDay(day, days)` takes a window; `STREAK_DAYS` = 366.
- **Tracker** ([feature/tracker](../../../apps/android/feature/tracker/src/main/kotlin/com/trackbit/feature/tracker)): `TrackerViewModel` (the picked past day lives in `SavedStateHandle`; null follows today across midnight). A past day reads `STREAK_DAYS` and requests history from `day − 365`; back on today it releases. Requests run off the display path behind a FIFO `Mutex`, after releasing any stale tracker request on start. `HabitRow` (accent block + icon, name, subtitle, badge line always reserved, type control), `TimeDialog` (`timeMs` validation), and `TrackerScreen` (day bar, `DatePickerDialog` limited to ≤ today, overflow menu with Log out).
- **Navigation:** `TrackerRoute` (was `TodayRoute`), `SessionRoute(habitId, day)` → `SessionPlaceholderScreen` in `app` until D3.
- **Strings:** the web tracker's hardcoded English moved to the locale JSON and the web now uses it: `tracker.{badge_*, check_*, count_completed, count_slips, sessions, no_sessions, mark_*, today, previous_day, next_day, go_to_today}`, `common.{cancel, save}` (CheckHabitRow, CountHabitRow, TimedHabitRow, ExerciseHabitRow, ProgressBadge, DateSelector). Android-only: `android_tracker_{decrement, choose_day, edit_time, time_title, minutes, seconds, open_session, more_options}`, `android_session_coming_soon`.
- **Icons:** `UI_ICONS` in `generate.mjs` → `ic_ui_*` (lucide, like the web), exposed as `UiIcons` in core:designsystem. 33 generated files.
- **Tests:** `StreakTest` (endingBefore), `HistoryTest` (per-owner recording, release clamp), migration 3→4, `HistorySyncTest` (chunks, failed chunk, two owners, past-day streak from pulled history), `TrackerRepositoryTest` (earlier day walks the week), `TrackerViewModelTest` (past day + history, midnight, restore, decrement floor, timers, `timeMs`).

## Next: D2 — session data layer

Read the backend's exercise session routes and the web's session mutations first. Plan §3 A7: add `Idempotency-Key` to session and performance creation. Keep the outbox FIFO and the pending-op guard in `SyncDao`. Sessions attach to a day log (`ensureDayLog` exists).

## Invariants — do not break these

(Plus those in the B and C handoffs.)

- **History is per owner.** Never delete or overwrite another owner's request. Logs before the recent week exist only while some request covers them.
- **A pull is recorded only on requests that start inside it**, and chunks go newest first. `logsKnownFrom` relies on Room being fresh from a recorded `syncedStart` up to today.
- **A streak is null when the logs can't tell**; never guess from empty days before `logsKnownFrom`.
- **The tracker's shown day comes from `TrackerViewModel.days`** (clock + picked day), never `LocalDate.now()` in a composable. Writes use the row's `TrackedHabit.day`.
- **Timed totals are edited only while no timer runs.**
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

## Landmines

- **`HistoryOwner` lives in core:model** because `widget` and features can't see core:database.
- **The emulator user has no check or anti-habit.** Create one on the web (`localhost:5173`) to see those rows.
- **Tapping by coordinates:** rows are about 230 px tall at 1080×2400; the day bar's ‹ is at (84, 294) and "go to today" at (996, 294).

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug --max-workers=2   # green, 0 lint issues, 221 tests (incl. core:model)
pnpm android:generate:check                                          # 33 generated files up to date
(cd apps/frontend && npx tsc -b)
pnpm --filter backend test
```

## Open questions

- None blocking. Deferred items are in [kotlin-app-followups.md](../tasks/kotlin-app-followups.md).

## Run log

- 2026-10-02 — D1: Phase 2 split into D1–D6. History per owner (Room v4) with chunked pulls and past-day streaks; tracker home with a day picker, rows per type, badges, timers and a time dialog; web tracker strings moved to the locale JSON; lucide UI icons generated. Verified on the emulator against the local backend. Next: D2.
