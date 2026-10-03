# Handoff: Kotlin app — Workstream D (main features)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §2.2 and §4 "Phase 2". Core and widget context: the "Invariants" and "Landmines" sections of [kotlin-app-B.md](kotlin-app-B.md) and [kotlin-app-C.md](kotlin-app-C.md), nothing else.
- **Status:** Phase 2 D1–D6 done on the emulator. The exit check is deferred to the final pass (user, 2026-10-03); Phase 3 continues in [kotlin-app-E.md](kotlin-app-E.md).
- **Branch:** `kotlin-app` · **Last run:** 2026-10-03 (D6, committed)

## Where we are

The signed-in app has a bottom bar: **Tracker** (D1) and **Stats** (D6). A workout row's play button opens the session screen (D3–D5, no bottom bar there). Stats shows one habit at a time (picker, first habit by default, kept in `SavedStateHandle`): three stat cards (completions, current streak, goal frequency; "–" until Room holds every log), a 53-week heatmap colored like the widgets with the tapped day's value, and for workout habits the exercise progression chart (metric + range, PR dots, tap marker), weekly volume (total / by exercise, RPE overlay on an end axis) and muscle balance (volume / frequency, horizontal bars).

On the emulator (API 36, local backend, the user's dev account): Check showed 7 completions / 0 streak / 5 % (7 logs since 2026-05-25), matching the web's formula. With 20 seeded workout days: Strenght max weight 3M = 20 sessions, 19 PRs, best 72.5 kg, marker "Aug 10, 2026: 60 kg / Personal record"; volume stacked by exercise with the RPE line at 8; muscle bars Chest = Triceps 23.4k kg, Back 14.6k kg. Seed removed and the app resynced. Not exercised: Spanish, imperial units, dark theme, offline (cached sets should still show), an anti-habit's heatmap.

`./gradlew assembleDebug testDebugUnitTest lintDebug` passes with 0 lint issues and 304 tests; backend 82 tests.

## Phase 2 task split (D1–D6)

| Task | Scope | Status |
|---|---|---|
| **D1** | Tracker home: day bar + date picker, rows per type, badges, anti-habits, frozen, pull-to-refresh | ✅ 2026-10-02 |
| **D2** | Session data: Room v5, session outbox ops keyed by client uuids, backend uuid/idempotency/ownership fixes | ✅ 2026-10-02 |
| **D3** | `feature/session`: session panel, log cards, set editor, units, catalog picker | ✅ 2026-10-02 |
| **D4** | Picker sources, prescriptions as new-set defaults, Play/next | ✅ 2026-10-02 |
| **D5** | Rest timer, `defaultRestSeconds` | ✅ 2026-10-02 |
| **D6** | `feature/analytics` + bottom bar | ✅ 2026-10-03 |
| **Exit** | Phase 2 exit check | next |

## Done (D6)

- **Backend** ([tracker.ts](../../../apps/backend/src/routes/app/tracker.ts) `GET /api/tracker/sets?habitId`): every set of a habit, flat (`day, exerciseId, weight, reps, rpe, duration, distance`), oldest first, 404 for another user's habit. [exercises.ts](../../../apps/backend/src/routes/app/exercise-info/exercises.ts) list now returns `muscleGroups: {id, name}[]` in the user's locale (the web's muscle chart read a field that never came). Tests: [tracker-sets.test.ts](../../../apps/backend/test/tracker-sets.test.ts); contracts `sets.json` (new) and `exercises.json` (re-recorded). No migration.
- **Web:** `ExerciseWithLastPerformance.muscleGroups` typed; the library shows the names; the muscle hook reads them typed. All analytics strings moved to `analytics.json` (en/es) and the components use `t()`.
- **core:model:** `HabitSetsResponse`/`HabitSet`, `Exercise.muscleGroups` (`MuscleGroupRef`), `HistoryOwner.Analytics`.
- **core:database v8** (auto-migration 7→8): `exercises.muscleGroups` (JSON, default `[]`), `habit_sets` + `habit_set_pulls` ([HabitSetEntities.kt](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/entity/HabitSetEntities.kt)), `HabitSetDao`, `SyncDao.applySets`.
- **core:data:** `TrackerSync.syncSets(habitId)` (sets + catalog, fenced), [AnalyticsRepository.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/AnalyticsRepository.kt); `TrackedHabit.firstLogDay`/`logsKnownFrom`/`allLogsKnown`; `DayClock` moved here.
- **core:designsystem:** [Heatmap.kt](../../../apps/android/core/designsystem/src/main/kotlin/com/trackbit/core/designsystem/component/Heatmap.kt) (Compose), [Units.kt](../../../apps/android/core/designsystem/src/main/kotlin/com/trackbit/core/designsystem/format/Units.kt) (moved from session); icons Activity, BarChart, BarChart2, CalendarDays, CircleCheck, TrendingUp.
- **feature/analytics** ([module](../../../apps/android/feature/analytics/src/main/kotlin/com/trackbit/feature/analytics)): `AnalyticsData.kt` (pure ports of the web hooks), `AnalyticsViewModel`, `AnalyticsScreen.kt`, `AnalyticsCharts.kt` (Vico 3.3.1 `compose-m3`).
- **app:** `AnalyticsRoute`, bottom `NavigationBar` on top-level routes (state saved per tab), insets consumed so inner Scaffolds don't double them.
- **Tests:** `AnalyticsDataTest` (7), `AnalyticsViewModelTest` (5), `AnalyticsRepositoryTest` (3), `UnitsTest` (moved), `MigrationTest` +1, `DecodeTest` +1 (and muscle groups).

## Next: the Phase 2 exit check

Exit: "a full workout can be logged in the app, and a day of habits can be tracked, with results identical to the web."

1. Run **Verify**. Then on the emulator, log a day of habits (count, check, timed with the timer, an anti-habit slip) and a full workout (session, two exercises, sets with RPE, a list pick with Play, rest timer), offline for part of it.
2. Compare with the web (`pnpm dev:frontend`, same account): tracker values, streaks, session contents, Stats numbers for the same habits. Note any difference in the follow-ups or fix it if it blocks.
3. The plan's unchecked "Error-code handling" bullet looks done (tracker and session snackbars use `errors_limits_*`; frozen rows locked); confirm with a frozen habit and a frozen custom exercise, then tick it.
4. Clean up whatever test data you add. Then update the plan's Phase 2 status and write the Phase 3 (Workstream E) handoff.

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
- **The rest timer is a `timers` row with `endsAt` set and no habit**; there is at most one (`replaceRest`). Habit timers have `endsAt` null; `observeHabitTimers` reads only those.
- **The rest timer starts only in `SessionRepository.addSet`.** Its notification and alarm follow Room (`TimerNotifier`, `RestAlarm`); actions change Room only.
- **Sources and queues are server data only** (nothing pending against them): they enter Room only through `SyncDao.applySources` / `applyQueue`, fenced like every pull.
- **Analytics sets are server data only** (`habit_sets`, written by `SyncDao.applySets`; pending sets aren't in them, as on the web). `observeSets` is null until the habit's first pull: show loading, not an empty chart.
- **Stat cards wait for every log** (`TrackedHabit.allLogsKnown`); like streaks, never guess from partial history.
- **The analytics math is the web's** (`AnalyticsData.kt`, ports of the `use-*-chart` hooks): change both or neither. Weights stay kg there; the UI converts.
- **Unit helpers live in `core:designsystem/format/Units.kt`** (`kgToDisplay`, `displayToKg`, `weightUnit`, `formatNumber`, `round`), shared by session and analytics. `DayClock` moved to `core:data`.
- **Composables take the locale from `LocalLocale.current.platformLocale`**, never `Locale.getDefault()` (lint `NonObservableLocale` fails the build).

## Decisions made in D6

| Question | Decision | Why |
|---|---|---|
| Where charts get sets | New `GET /api/tracker/sets` + Room v8 cache (user) | Room only had days the session screen opened; the cache keeps charts offline. |
| Muscle chart | Horizontal bars, most trained first (user) | Vico has no radar; bars fit a phone and work with < 3 groups. |
| Navigation | Bottom bar Tracker / Stats (user) | Room for Phase 3's tabs. |
| Stats period | All time, like the web (user): `HistoryOwner.Analytics` from the earliest first log of any habit | Switching habits needs no new pull. |
| Muscle groups on the list | Returned by `GET /exercises`; persisting them on user create/update left for later | That bug predates D6; it's in the follow-ups. |
| Chart controls | Screen state per card (`rememberSaveable`, reset per habit) | The web keeps them in each chart's `useState`. |
| Week start | Heatmap: the locale's; volume weeks: ISO Monday | Heatmap matches the widgets; volume matches the web's ISO weeks. |
| Marker | Toggle on tap, label around the point | Press-only vanished on a tap; `Top` reserved room for 8 lines. |

## Decisions made in D5

| Question | Decision | Why |
|---|---|---|
| What starts a rest | Adding a set (user) | Web sets have no "done" flag; you add a set once it's done. Editing a set doesn't restart it; a newer set replaces the running rest. |
| Where it starts | In `SessionRepository.addSet`'s transaction | New-set rules live there; a refused set (frozen) starts nothing. |
| Rest length | Prescribed `restSeconds`, else `defaultRestSeconds`; 0 = none (and ends the running one) | The plan; 0 as "off" (user). |
| `defaultRestSeconds` | `NOT NULL DEFAULT 90`, CHECK 0–3600 (migration 0012, local dev only); Zod 0–3600; `SessionUser` defaults to 90 when absent | A user cached by an older build must still decode. |
| Where to edit it before Phase 3 | Top bar of the session screen (user) | Phase 3's settings screen reuses `PreferencesRepository.setDefaultRestSeconds`. |
| Storage | `timers.endsAt` (Room v7); rest row has no habit/day; at most one (`TimerDao.replaceRest`) | Stored instants, like habit timers. |
| End alert | `RestAlarm` follows Room and sets an exact alarm when allowed (`SCHEDULE_EXACT_ALARM`), else inexact (user) | Play-safe; `USE_EXACT_ALARM` is for alarm/calendar apps. Re-set when the grant broadcast arrives. |
| Who ends it | `RestAlarmReceiver` → `finishIfDue()`: alert if ended within 2 min, else drop silently (reboot) | No boot receiver needed: a new process re-sets the alarm, a stale rest ends quietly. |
| Notifications | Countdown in the `timers` channel (`setTimeoutAfter` = end); alert in a new high-importance `rest_alerts` channel | The countdown disappears exactly at the end; the alert is a separate heads-up. |
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
- **Production needs migrations `0008`–`0012`** and the `/days` backend.
- **`HistoryOwner` lives in core:model** because `widget` and features can't see core:database.
- **Room schema `N.json` is exported during compile, after test assets are collected**: the first `testDebugUnitTest` after a version bump fails `MigrationTest` with "Missing file …/8.json"; run it again.
- **D6's emulator check used seeded data**: 20 workout days on habit 10 (Jul–Sep) and three `d6-*` muscle groups, all deleted afterwards. The dev DB now has **no muscle groups at all**, so the muscle card shows its empty text until some exist (admin route, or SQL).
- **Pull-to-refresh doesn't re-pull history younger than 6 h**: after deleting server rows by hand, restart the app (the analytics screen's init releases and re-requests its history) to resync.

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug --max-workers=2   # green, 0 lint issues, 304 tests (run again if MigrationTest misses 8.json)
pnpm android:generate:check                                          # 50 generated files up to date
(cd apps/frontend && npx tsc -b)
pnpm --filter backend test                                           # 82 tests
```

## Open questions

- None blocking. Deferred items are in [kotlin-app-followups.md](../tasks/kotlin-app-followups.md) (new in D6: user exercise create/update drops muscle groups; history not re-pulled on pull-to-refresh; web heatmap/exercise-picker differences).

## Run log

- 2026-10-02 — D1: Phase 2 split into D1–D6. History per owner, tracker home, web tracker strings in the locale JSON, lucide UI icons. Next: D2.
- 2026-10-02 — D2: client uuids on sessions, logs and sets (migration 0011); `{ habitId, day }` session create and a day read; idempotent creates; ownership fixes. Room v5, session outbox ops, `SessionRepository`. Next: D3.
- 2026-10-02 — D3: repaired the half-split D1+D2 commit (`996c4fc`). `feature/session` (classic/compact cards, set editors, units, catalog picker); new-set defaults in `addSet`; fixed the session ops' `send` crash found on the emulator; RPE names in the locale JSON; `DurationDialog` shared. Android 244 tests. Next: D4.
- 2026-10-02 — D4: exercise sources (DTOs, contracts, Room v6 cache, `syncQueue`), preferred source via `PreferencesRepository`, prescriptions first in `addSet`, the picker (source dropdown, queue sheet, Play walking the queue). Android 273 tests. Next: D5.
- 2026-10-02 — D5: rest timer. Backend `defaultRestSeconds` (migration 0012, PATCH, session field); Room v7 `timers.endsAt`; `RestTimerRepository`; `addSet` starts rest; countdown notification + exact/inexact end alarm + "Rest over" alert; session rest bar and default button. Android 287 tests. Next: D6.
- 2026-10-03 — D6: `GET /api/tracker/sets`, muscle groups on the exercise list, web analytics strings to `t()`; Room v8 (`habit_sets`), `AnalyticsRepository`, `HistoryOwner.Analytics`; Compose heatmap, `feature/analytics` with Vico charts; bottom bar. Android 304 tests. Next: Phase 2 exit check.
