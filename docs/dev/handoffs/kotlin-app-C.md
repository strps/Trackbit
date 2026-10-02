# Handoff: Kotlin app — Workstream C (widgets)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §2.2 and §4 "Phase 1". Phase 0 context (core modules, their invariants, landmines) is in [kotlin-app-B.md](kotlin-app-B.md): read its "Invariants" and "Landmines" sections, nothing else.
- **Status:** Phase 1 — C1–C5 done on the emulator (widget foundation, W2 Today list, W1 quick-log, timer engine, W3 heatmap, previews). The real-device exit check is deferred to the end (user decision, 2026-10-02); the emulator stands in until then.
- **Branch:** `kotlin-app` · **Last run:** 2026-10-02 (C5 previews; uncommitted at end of run unless the user asked to commit)

## Where we are

W2 (Today list) works end to end on the emulator (API 36, Pixel Launcher, local backend): dynamic color, check toggle, count +1, offline taps reach the server exactly once after reconnecting, midnight rollover, sign-out/in. W1 (quick-log) works on the emulator too: placing it opens the habit picker, and a tap logs +1 at 2×1, 2×2 and 1×1 (checked on the server). Reconfiguring with the launcher's pencil switches the habit on a live session, and resizing switches the layout. Not verified on the emulator for W1: the offline, midnight, signed-out and habit-removed states (unit-tested; queued in [kotlin-app-followups.md](../tasks/kotlin-app-followups.md) for the C5 device pass). Timed habits (C3) work on the emulator too: a W1 tap starts a timer, the widget shows a live chronometer against the goal, and an ongoing notification appears with Stop / +30s. The timer survived a reinstall, +30s moved it forward, and Stop from either the notification or the widget added the elapsed ms to the server's day log (a second session added to the first). The 1→2 Room migration kept the emulator's data. W3 (heatmap, C4) works on the emulator: placing it opens the shared habit picker, and within seconds the grid shows the habit's days from months back (pulled from the new `/api/tracker/days`), matching the server's rows day by day, with Sunday-first weeks from the en-US locale. Not verified on the emulator for W3: releasing history when the last one is removed, dark mode, 4×3 (unit-tested or queued in the follow-ups). `./gradlew assembleDebug testDebugUnitTest lintDebug` passes with 0 lint issues and 196 unit tests (22 new); backend Vitest 56 passing. C5 (2026-10-02): the widget picker shows a preview of each widget with sample habits ("Drink water", "Read", "Meditate"), as a generated preview on Android 15+ and a static `previewLayout` on 12+, both checked on the emulator in light and dark. C5 also fixed two W3 bugs the dense sample exposed: a heatmap with most days logged went past Glance's view limit (the widget would show its error layout), and lightly logged days rendered dark instead of pale. `./gradlew assembleDebug testDebugUnitTest lintDebug` passes with 0 lint issues and 202 unit tests (6 new). Not done: the real-device run (deferred).

## Phase 1 task split (C1–C5)

| Task | Scope | Status |
|---|---|---|
| **C1** | Glance setup, `WidgetDay` + midnight alarm, `WidgetUpdater`, theme, W2 with signed-out/empty/frozen/error states | ✅ 2026-09-28 |
| **C2** | W1 habit quick-log: config activity (habit picker), 1×1 / 2×1 / 2×2 (`SizeMode.Responsive`), progress ring + streak, 7-day strip at 2×2; check/count only | ✅ 2026-09-29 |
| **C3** | Timer engine in `core:data` (persisted start + duration), ongoing Chronometer notification (Stop / +30s), timed habits start/stop in W1 and W2 | ✅ 2026-09-29 |
| **C4** | W3 heatmap + shared habit picker; history beyond Room's 7 days via a new lean `/api/tracker/days` | ✅ 2026-09-29 |
| **C5** | Previews (`previewLayout` 31+, generated previews 35+); final exit check on a real device | ✅ previews 2026-10-02 · device check deferred |

## Done (C1)

- **Robolectric on API 36 everywhere** (user decision): `isIncludeAndroidResources = true` in [AndroidLibraryConventionPlugin.kt](../../../apps/android/build-logic/convention/src/main/kotlin/AndroidLibraryConventionPlugin.kt). The switch surfaced a real race in `SessionStore.currentToken()`: once a failed startup read had completed, it returned `null` (signed out) instead of rethrowing. It now awaits (and rethrows) whenever `loaded` is cancelled, and a deterministic test covers it.
- **Build:** `trackbit.android.widget` convention plugin ([AndroidWidgetConventionPlugin.kt](../../../apps/android/build-logic/convention/src/main/kotlin/AndroidWidgetConventionPlugin.kt)): library + compose + hilt + designsystem + i18n + Glance 1.2.0 (`glance-appwidget`, `glance-material3`), Robolectric + `glance-appwidget-testing` for tests. `widget/build.gradle.kts` applies only it.
- **Refresh model** (verified against Glance 1.2 source: `update()` never re-runs `provideGlance` on a live session, which lives ~45 s):
  - `provideGlance` loads the first state, then **collects inside `provideContent`**, so a running session follows Room by itself ([TodayWidget.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/today/TodayWidget.kt)).
  - [WidgetUpdater.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/WidgetUpdater.kt) calls `updateAll` for every widget on `TrackerRepository.changes` or an auth change (including the first known state per process). Started from `TrackbitApplication.onCreate`, next to `PeriodicSync`.
  - `TrackerRepository.changes` (new) = Room invalidation of `habits` + `day_logs` (`HabitEntity.TABLE`, `DayLogEntity.TABLE`). Chosen over "observe today's rows" so a stale day can't hide a change.
- **Day** ([WidgetDay.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/WidgetDay.kt)): `today: StateFlow<LocalDate>`; `refresh()` re-reads it and arms a non-wakeup `RTC` `setWindow` alarm at the next local midnight (DST-safe: `atStartOfDay(zone)`). Called by every `provideGlance` and by [DayRolloverReceiver](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/DayRolloverReceiver.kt) (alarm, `TIME_SET`, `TIMEZONE_CHANGED`), which re-arms only while widgets are placed. Boot and app updates are covered because the host re-requests updates, which runs `provideGlance`.
- **Registry:** [TrackbitWidgets.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/TrackbitWidgets.kt) lists every widget (`updateAll`, `anyPlaced`) and holds `WidgetEntryPoint` (tracker, auth, widgetDay). **Add each new widget to `all()`.**
- **Actions** ([HabitActions.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/action/HabitActions.kt)): `ToggleHabitAction`, `IncrementHabitAction` take `habitParameters(habit)` = id + the row's `day`, and write through `TrackerRepository`. No network, no explicit update: `WidgetUpdater` re-renders.
- **UI** ([ui/WidgetUi.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/ui/WidgetUi.kt)): `WidgetTheme` (dynamic on 12+, else the web palette via the now-public `TrackbitLightColors`/`TrackbitDarkColors`), `WidgetSurface`, `WidgetMessage`, `openAppAction` (launch intent, so `widget` doesn't depend on `app`). Error UI is [widget_error.xml](../../../apps/android/widget/src/main/res/layout/widget_error.xml).
- **W2** ([today/](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/today)): header (title + localized short date, opens the app); rows with icon, progress text + streak (≥ 2) + Frozen, progress bar (not for check or anti-habits); trailing checkbox (check), +1 button (count/negative), lock (frozen). Timed/complex/unknown rows open the app. Anti-habits after a header. `stateDefinition = null` (all state is in Room). 4×2 default, resizable.
- **Shared formatting:** `HabitProgress.displayText(type)` and `formatDuration` moved from `TodayScreen` to [core:designsystem format/ProgressText.kt](../../../apps/android/core/designsystem/src/main/kotlin/com/trackbit/core/designsystem/format/ProgressText.kt).
- **Strings:** `android_widget_today_label`, `android_widget_today_description`, `android_widget_sign_in` (en, es) in `strings_android.xml`.
- **Tests** ([widget/src/test](../../../apps/android/widget/src/test/kotlin/com/trackbit/widget)): `nextMidnight` (incl. Santiago's 2026-09-06 DST gap → 01:00), `widgetRefreshes`, `todayWidgetState`, and Glance content tests (signed out, empty, +1 action with parameters, frozen = lock and no click, timed opens the app, anti-habit header).

## Done (C2)

- **W1** ([quicklog/](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/quicklog)): `QuickLogWidget` + receiver, listed in `TrackbitWidgets.all()`. Per-instance state is only the habit id (`intPreferencesKey("habitId")` in the default `PreferencesGlanceStateDefinition`). `QuickLogWidget.choose(context, glanceId, habitId)` writes it and calls `update`.
- **Following a reconfigure:** inside `provideContent`, `currentState(HabitIdKey)` → `rememberUpdatedState` → `snapshotFlow` feeds `quickLogState(auth, day, tracker, habitId: Flow<Int?>)`. `update()` on a live session replaces the Glance state (a Compose `MutableState` in `AppWidgetSession`), so the widget switches habits without a blank frame. Verified on the emulator.
- **States** ([QuickLogState.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/quicklog/QuickLogState.kt)): `SignedOut` → `Unconfigured` (no id) → `HabitRemoved` (`observeHabit` is null) → `Tracking`. Nothing is cleared on deletion or sign-out: the state is derived each time, so a habit that returns shows up again. Removed/unconfigured taps open the config activity for that widget.
- **Layouts** ([QuickLogWidgetContent.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/quicklog/QuickLogWidgetContent.kt)): `SMALL` 40×40 = ring + icon; `WIDE` 110×40 = ring + name + details; `SQUARE` 110×110 = big ring, name, details, 7-day strip. Anything narrower than `WIDE` is Small, even a tall 1×2. The whole widget is one tap target: `logAction(habit)`, else open the app (timed/complex), and nothing when frozen (the lock replaces the icon). A `semantics` content description names the action ("Add 1 to X", "Mark X as done/not done").
- **Ring** ([ui/ProgressRing.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/ui/ProgressRing.kt)): Glance has no determinate circular indicator. The track is a tinted vector (`ic_widget_ring_track`, so it follows the theme), and the arc is a 288 px bitmap in the habit color drawn to the same geometry. Both `fillMaxSize` + `ContentScale.Fit`, so the ring fills whatever space the layout gives it. Anti-habits: a full ring while clean, an `error`-tinted track after a slip.
- **Strip:** each day uses the heatmap scale (`colorStops.colorAt(fraction)`), with `surfaceVariant` when empty. For anti-habits only slips are marked (`error`); clean days aren't, because `TrackedHabit` doesn't carry `firstLogDay`.
- **Config activity** ([QuickLogConfigActivity.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/quicklog/QuickLogConfigActivity.kt)): `@AndroidEntryPoint` + `@HiltViewModel` reusing `todayWidgetState` for the list. `RESULT_CANCELED` first, so backing out removes a new widget. It's exported (the launcher needs that), so it finishes unless the id's provider is `QuickLogWidgetReceiver`. `taskAffinity=""` + `excludeFromRecents`. Provider XML: `widgetFeatures="reconfigurable"`, 2×1 default, resizable from 40×40.
- **Shared with W2:** `logAction(habit): Action?` in [HabitActions.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/action/HabitActions.kt) (replaces W2's `loggableFromWidget`), `TrackedHabit.detailsText(context)` in [ui/HabitText.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/ui/HabitText.kt), and `WidgetSurface(horizontalPadding, verticalPadding)`.
- **Build:** the widget convention now adds `activity-compose`, `hilt-lifecycle-viewmodel-compose` and `lifecycle-runtime-compose`.
- **Strings** (en, es): `android_widget_sign_in_short`, `android_widget_quick_log_{label,description,choose,removed}`, `android_tracker_mark_{done,not_done}`.
- **Tests:** `QuickLogStateTest` (session, id changes, day, removal and return) and `QuickLogWidgetContentTest` (the three layouts, toggle description, frozen = no click, timed opens the app, removed opens the picker, signed-out 1×1). `registerLauncherActivity()` moved to `Fixtures.kt`.

## Done (C3)

- **Storage** ([TimerEntity.kt](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/entity/TimerEntity.kt), [TimerDao.kt](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/dao/TimerDao.kt)): a `timers` table holding `startedAt`, never a count. `habitId` (cascade FK, unique) and `localDay` are nullable, so the rest timer can reuse the table and the notification. Room version 2 via `AutoMigration(1, 2)`, covered by a Robolectric `MigrationTest` (`room-testing`). The Room convention now adds `schemas/` to unit-test assets.
- **One query:** `HabitDayDao` now LEFT JOINs `timers` and returns flat `HabitDayRow`s (prefixed embedded log and timer columns). Stopping a timer deletes it and logs its time in one transaction, so no frame shows half of that.
- **`TrackerRepository`:** `startTimer(habitId, day)` (timed and not frozen only, local only, no outbox op), `stopTimer(habitId)`, `addToTimer(habitId, ms)`, `observeRunningTimers()`. **Stop increments** by the elapsed ms (`/check/increment`), not `setRating` as planned: time logged elsewhere meanwhile isn't overwritten, and delete + increment in one transaction make a second stop (widget and notification at once) a `NoChange`. New `WriteResult.NoChange`. `changes` also watches `timers`. A `java.time.Clock` (UTC) is provided in `DataModule`.
- **`TrackedHabit`:** `timer: HabitTimer?` (`startedAt`, `day`), `timerAddsToDay`, `progressAt(now)` (logged + running time) and `timerBase` (when the shown total was 0: the chronometer base).
- **Notification** ([app/timer/](../../../apps/android/app/src/main/kotlin/com/trackbit/app/timer)): `TimerNotifier` (started in `TrackbitApplication`) reconciles notifications with `observeRunningTimers()`. It's tagged `habit-timer`, id = habit id, and counts up from `timerBase` (the day's total). Channel `timers`, low importance, `CATEGORY_STOPWATCH`, small icon = the habit's icon, color = the habit's color. `TimerActionReceiver` handles Stop / +30s (Hilt through an `@EntryPoint`: `@AndroidEntryPoint` receivers don't compile here, `super.onReceive` is abstract to Kotlin). Sign-out needs no hook: clearing Room empties the flow, which cancels them all.
- **Permission:** `POST_NOTIFICATIONS` is asked once per install, in the app after sign-in (`RequestNotificationPermission` in `TrackbitNavHost`, flag in SharedPreferences `permissions`). On grant, `TimerNotifier.onPermissionGranted()` posts the running timers. Without it, timers still run and show in the widgets.
- **Widgets:** `logAction` returns `StartTimerAction` / `StopTimerAction` for timed habits. While a timer runs, `HabitDetails` ([ui/HabitText.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/ui/HabitText.kt)) renders `widget_timer.xml` through `AndroidRemoteViews`: a `Chronometer` plus the suffix (" / 1:00 · 3 day streak") in one RemoteViews layout. W1 swaps the icon for a stop glyph and draws the ring as of the render. W2 gets a play/stop button. `widget_timer_text` follows day/night, dynamic on 12+.
- **Strings** (en, es): `android_tracker_{start,stop}_timer`, `android_timer_{channel_name,channel_description,stop,add_30s,goal}`.
- **Tests:** repository (start/stop once, past midnight, one per habit, live progress/base, +30s, cascade and frozen), DAO join, migration, W1/W2 timed actions, `timerSuffix`.

## Done (C4)

- **Backend** (user decision: a lean endpoint rather than `/history`, which carries full exercise session trees): `GET /api/tracker/days?start&end` → `{ start, end, days: [{ habitId, day, rating, sessionCount }] }`, sparse, both bounds required, at most 371 days. It shares `daySummaries()` with `/today`, so `sessionCount` means the same thing. Tests in `tracker-today.test.ts`; contract `days.json` (core:model) recorded. **Production needs this deployed before the app ships** (with 0008–0010).
- **Model/network:** `DaysResponse` + `HabitDayValue` ([Days.kt](../../../apps/android/core/model/src/main/kotlin/com/trackbit/core/model/Days.kt)), `TrackerService.days(start, end)`.
- **Storage:** history lives in `day_logs` itself (same key and shape). A one-row `history` table ([HistoryEntity.kt](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/entity/HistoryEntity.kt), Room v3 via `AutoMigration(2, 3)`) says how far back to keep (`start`) and what the last pull covered (`syncedStart`, `syncedAt`). `SyncDao.applyDays` makes the range match the server, keeping pending-op days and skipping habits Room doesn't have, and records the pull only if the request still exists. `HistoryDao.release(keepFrom)` deletes the request and the logs before the recent week (pending ones stay). `PendingDay` is now `HabitDayKey`.
- **Sync:** `TrackerSync.syncHistory()` (under the mutex, fenced) pulls `[start, device today]` when due: never pulled, pulled from a later start, or older than `HISTORY_MAX_AGE` (6 h). `sync()` (periodic + pull-to-refresh) also pulls when due. `HistoryWorker` = unique `tracker-history`, `APPEND_OR_REPLACE`, tagged `tracker-sync`, so sign-out cancels it. `TrackerSync` now takes the `Clock`.
- **Repository:** `observeHabit(habitId, day, days = RECENT_DAYS)` (`HabitDayDao.observeHabitDay` takes the window length; still one query), `requestHistory(start)` (stores it, schedules a pull only if due), `releaseHistory()`.
- **Shared habit widget code** ([habit/](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/habit)): `HabitWidgetState` + `habitWidgetState(auth, day, habitId, observe)` (was W1's `QuickLogState`), `HabitIdKey`, `chosenHabitId`/`chooseHabit`, and `HabitPickerActivity` (was `QuickLogConfigActivity`), which maps the provider to W1 or W3 and finishes for anything else. Strings `android_widget_choose_habit`, `android_widget_habit_removed` (renamed from `quick_log_*`). `dayColor` ([ui/DayColor.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/ui/DayColor.kt)) is shared by W1's strip and W3.
- **W3** ([heatmap/](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/heatmap)): `HeatmapWindow` = 26 weeks ending with today's, weeks from the locale's first day. The window is fixed whatever the size, so all instances ask for the same history. Its `observe` calls `requestHistory(window.start)` then reads `window.days` days, so a new day or a sign-in re-asserts the request. `SizeMode.Exact`: `gridFor(size)` makes cells as big as the height allows (8–18 dp pitch), then fits as many weeks as the width takes. Week columns go in Rows of ≤ 10 (Glance's limit). Each cell is a tinted rounded-square vector (`ic_widget_cell`) whose padding is the gap: one view when empty, and a colored day is drawn over the empty cell like the web. Header: icon, name, `HabitDetails`. The whole widget opens the app. `HeatmapWidgetReceiver.onDisabled` → `releaseHistory()`. Provider: 4×2 default, resizable from 180×110 dp, reconfigurable.
- **Strings** (en, es): `android_widget_heatmap_{label,description}`.
- **Tests:** `HistoryTest` (applyDays, pending guard, release, longer window), migration 2→3, `HistorySyncTest` (request/pull/stale/earlier start/offline/fence/release), scheduler cancel, `DaysResponse` decode, `HeatmapWindowTest` (window, weeks, sizing, history request), `HeatmapWidgetContentTest`, `HabitWidgetStateTest` (moved).

## Done (C5)

- **Sample data** ([preview/PreviewHabits.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/preview/PreviewHabits.kt)): "Drink water" (count 5/8, 12-day streak, Blue, a seeded 26-week history), "Read" (check, done), "Meditate" (timed 10/15 min). Names are new strings `android_widget_preview_{water,read,meditate}` (en, es). A fixed day (`PreviewHabits.DAY`), since no preview shows a date: W2 takes `showDate = false`.
- **Generated previews (Android 15+):** each widget overrides `providePreview` with its real content composable and the sample state. W1 renders at its minimum size (the 2×1 layout); W3 uses a `Responsive` ladder of 4×2-ish sizes (`PREVIEW_SIZES`), since previews have no exact size and the grid is sized, not stretched.
- **Publishing** ([preview/WidgetPreviews.kt](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/preview/WidgetPreviews.kt)): `WidgetPreviews.start()` from `TrackbitApplication.onCreate`, and `WidgetPreviewReceiver` on `MY_PACKAGE_REPLACED` and `LOCALE_CHANGED`. Each widget is published unless SharedPreferences `widget_previews` already records it for the current render key (`lastUpdateTime|locales`), and recorded only on success, per widget. A mutex serializes the two triggers. `WidgetEntryPoint.previews()` added.
- **Static previews (Android 12+)** ([layout-v31/](../../../apps/android/widget/src/main/res/layout-v31)): `widget_preview_{today,quick_log,heatmap}.xml`, set as each provider's `previewLayout`. Same sample habits and Glance's dynamic colors (`values[-night]-v31/colors_preview.xml`). Details show the progress only: XML can't format the streak plural. W1's arc is a vector (`widget_preview_ring_arc`), W3's grid a generated 16-week vector (`widget_preview_heatmap`, `tools:ignore="VectorPath"`).
- **W3 fix: one view per day.** A colored cell was a Box with two Images (3 views), and Glance allows ~500 views per layout, so a 4×2 heatmap with most of its 182 days logged threw "There are too many views". Now a full week's Column has the seven empty squares as one background image (`widget_week_empty`, color `widget_cell_empty` = `surfaceVariant` per theme, resolved by the launcher), and each day is one tinted `ic_widget_cell` or a Spacer. Today's partial week keeps per-cell empty squares (≤ 7). Worst case about 290 views.
- **W3 fix: translucent day colors.** Glance tints with `setColorFilter` (SRC_ATOP), which blends a translucent tint onto the drawable's own black, so the gradient's low end came out dark. `CellShape` now tints with the opaque color and puts the alpha on the image (`Image(alpha = …)`). The gap is drawn into `ic_widget_cell` itself (16-unit viewport, inset 2), so it lands exactly on the background's squares (padding was rounded to whole pixels and was off by 1 px).
- **Tests:** `WidgetPreviewsTest` (every widget's preview translates to RemoteViews; a fully logged heatmap fits at 180×110 to 350×260, which fails on the C4 cells; the sample fills the window), `PublishIfStaleTest` (once per key, refused publishes retry, per widget).

## Next

1. **The real-device exit check (deferred by the user to the end):** W1 + W2 installed; offline logging reaches the web once after reconnecting; midnight reset. Work through the "To check on a device" list in [kotlin-app-followups.md](../tasks/kotlin-app-followups.md) at the same time.
2. Otherwise Phase 1 is complete on the emulator. Phase 2 continues in [kotlin-app-D.md](kotlin-app-D.md).

## Invariants — do not break these

(Plus every invariant in [kotlin-app-B.md](kotlin-app-B.md#invariants--do-not-break-these).)

- **Widgets never call the network or DAOs.** Reads: `TrackerRepository.observeDay/observeHabit`. Writes: `TrackerRepository` actions. Refresh: `WidgetUpdater`, driven by `changes`.
- **Widget composables collect their flows inside `provideContent`.** A value captured in `provideGlance` goes stale on a live session.
- **The widget day comes from `WidgetDay.today`**, never `LocalDate.now()` in a composable, and writes use the row's `TrackedHabit.day`.
- **Every widget is listed in `TrackbitWidgets.all()`**, or it misses rollover and data refreshes.
- **Per-widget Glance state holds only the user's choice** (a habit widget's id, `HabitIdKey`). Everything it shows is derived from Room, so deletion and sign-out need no cleanup.
- **What a tap logs comes from `logAction(habit)`**, for every widget.
- **Hilt reaches Glance classes only through `WidgetEntryPoint`** (Glance instantiates widgets, receivers and callbacks itself). The entry point must stay public.
- **Strings come from `com.trackbit.core.i18n.R`**, not the widget's `R` (R classes are non-transitive).
- **A timer is a stored start instant, never a ticking count.** Stopping it deletes the row and logs in the same transaction.
- **Timer notifications follow Room** (`TimerNotifier`). Never post or cancel them from an action: change the timer and let the reconciler catch up.
- **History is asked for, never fetched by a widget.** A widget calls `requestHistory(start)`, and the pull happens in `TrackerSync` (worker or periodic sync). Logs older than the recent week exist in Room only while a `history` request does; `releaseHistory()` drops them.
- **A new habit widget is added to `HabitPickerActivity.habitWidgetFor`**, or the picker refuses to configure it.
- **History requests are per owner** (since D1): W3 uses `HistoryOwner.Heatmap`.
- **Every widget has a preview:** `providePreview` with `PreviewHabits`, a `previewLayout`, and its receiver in `WidgetPreviews.RECEIVERS`.
- **A heatmap day is one view.** Check the view count of anything drawn per day (Glance's limit is ~500 per layout); `WidgetPreviewsTest` renders a fully logged grid.

## Decisions made in C5

| Question | Decision | Why |
|---|---|---|
| Preview data | Fixed sample habits, not the user's | The picker shows previews before any widget exists, and the system keeps one until it's republished (rate-limited). |
| When to publish | App start, update, locale change; recorded per widget and render key | An update clears generated previews (seen on the emulator), and the text is localized. Retrying on every trigger is cheap. |
| Android 8–11 | No preview (app icon) | `previewLayout` needs 12+; a `previewImage` would be a fixed rendered image. Queued in the follow-ups. |
| W3 cells | One view per day, empty squares as a week background | The only layout that stays well under Glance's view limit while keeping the empty color theme-aware. |
| Real-device check | Deferred to the end (user) | The emulator covers it for now. |

## Decisions made in C4

| Question | Decision | Why |
|---|---|---|
| Where history comes from | New `GET /api/tracker/days` (user decision) | `/history` sends every session → log → performance tree; the heatmap needs one number per day. |
| Where it's stored | `day_logs`, plus a one-row `history` request | Same key and shape, so the pending-op guard and optimistic writes cover old days for free; the request row gives freshness and a clean release. |
| How much | 26 weeks for every instance, whatever the size | One request for all instances; the small size only shows fewer of the weeks. |
| Freshness | Pull when not covered or older than 6 h; periodic sync checks | Past days rarely change, and `/today` refreshes the last week every 15 min. |
| When history stops | `onDisabled` of the last W3 | Otherwise every install pulls history forever after one heatmap. |
| Cells | Tinted vector per cell, padding = gap; colored days over the empty cell | One view per empty cell (up to 182 cells), rounded on every API level, follows day/night; the gradient's low end is translucent, as on the web. |
| Labels | None (no months, weekdays or today marker) | The 10-child limit makes aligned label rows awkward; queued as polish. |
| Week start | The locale's first day | The web hardcodes Monday; the device's convention reads better on a home screen. |

## Decisions made in C3

| Question | Decision | Why |
|---|---|---|
| Foreground service? | **None** (the plan said one while a timer runs) | Nothing has to run: the start is stored and the Chronometer ticks in SystemUI. An FGS on 14+ would need `specialUse` + a Play declaration. Cost: on 14+ the user can swipe the notification away (the timer keeps running in the widgets). The rest timer's end alert (Phase 2) decides its own mechanism. |
| Stop writes | `increment(elapsed)` | Can't overwrite time from another device; atomic with deleting the timer. |
| Timer across midnight | Logs to the day it started | Same as the web; the widget shows it on the new day without adding it to that day's total. |
| Live time in widgets | RemoteViews `Chronometer` via `AndroidRemoteViews` | Glance has none, and re-rendering every second isn't possible. The suffix lives in the same layout because Glance's container for RemoteViews takes the whole row. |
| Permission prompt | Once, in the app after sign-in | A widget can't ask. |
| Where the notification lives | `app` | It needs `core:data`, designsystem icons and `MainActivity`; the widget and features can't depend on it. |

## Decisions made in C2

| Question | Decision | Why |
|---|---|---|
| Progress ring | Tinted vector track + bitmap arc | Glance's `CircularProgressIndicator` is indeterminate. A bitmap needs a concrete color, which the habit color is; the theme-dependent track stays a tinted vector. |
| Tap target | The whole widget | Too small for separate controls at 1×1; the same at every size. |
| Frozen | No click; a lock replaces the icon | Same as W2. |
| Habit deleted / other account | Derived "removed" state, id kept | Nothing to clean up, and the same account signing in again gets its widget back. |
| Default size | 2×1 | Name and progress fit; 1×1 shows only the ring. |
| Anti-habit ring | Full while clean, error track after a slip | Anti-habits have no goal to fill toward (W2 hides their bar). |

## Decisions made in C1

| Question | Decision | Why |
|---|---|---|
| Which widget first? | W2 before W1 | W2 needs no config activity or timer, so it exercises all shared infrastructure alone. |
| Where is `WidgetUpdater`? | `widget`, fed by a new `TrackerRepository.changes` in `core:data` | The plan put it in `core:data`, but `core:data` can't see Glance classes. The data seam stays in `core:data`. |
| Midnight rollover | Non-wakeup `RTC` `setWindow` alarm, re-armed on each render | Exact alarms need a user-granted permission on 13+. Android 12+ widens the window to 10 min (seen in `dumpsys alarm`); a sleeping device gets it on wake. |
| Refresh signal | Room invalidation, not "today's rows changed" | A process holding yesterday's day would miss today's writes until the alarm fires. |
| Explicit `update()` in action callbacks? | No | The Room write triggers `WidgetUpdater`, so writes need no hook (plan §2.2). Latency on the emulator: under a second. |
| Share the midnight source with `DayClock`? | No | Screens need a live tick while collected; widgets need an alarm. Nothing else consumes it yet. |

## Landmines

- **Glance allows about 500 views per layout** ("There are too many views", then the error layout). A `background(ImageProvider)` costs two extra views (Glance wraps the target in a Box with an Image); only `background(color)` stays on the view.
- **`ColorFilter.tint` with a translucent color draws it dark** (SRC_ATOP over the drawable's opaque fill). Tint with the opaque color and use `Image(alpha = …)`.
- **`setWidgetPreview` is rate-limited per widget** (a second publish within minutes is refused) and an app update clears published previews. When refused, the picker falls back to `previewLayout`, even on 15+, so repeated dev installs mostly show the static layouts.

- **Glance drops a Row's or Column's children past the tenth** (it only logs). W1's 7-day strip first used Spacers between cells (13 children) and lost today's cell. Use padding for gaps.
- **Robolectric runs on targetSdk (36) because the library convention sets `isIncludeAndroidResources = true`.** Without it, Robolectric can't read the manifest and falls back to API 23, below minSdk. That was the state until C1 (probe-tested). Don't remove it. Pin a single test with `@Config(sdk = …)` only when an API-specific behaviour matters.
- **Robolectric on API 36 needs `--add-exports=java.base/jdk.internal.access=ALL-UNNAMED`** (it creates `ApplicationSharedMemory` through FileDescriptor internals). Added once for every module in [KotlinAndroid.kt](../../../apps/android/build-logic/convention/src/main/kotlin/com/trackbit/buildlogic/KotlinAndroid.kt).
- **Glance test matchers:** the click action sits on the container, the text or description on its child. Match `hasClickAction… and hasAnyDescendant(hasText…)`. `openAppAction` needs a launcher activity: tests register one with `shadowOf(packageManager)`.
- **Glance runs `provideGlance` as a WorkManager worker** through the app's `Configuration.Provider`. `CancelSyncOnSignOut` cancels only the `tracker-sync` tag, so it doesn't touch Glance's work. Keep it that way.
- **Emulator:**
  - Setting the clock: `date` is refused on the Play image, even after `adb root`. Use `adb shell settings put global auto_time 0` and `adb shell cmd alarm set-time <epoch ms>`. Restore with `auto_time 1`. Inspect the alarm with `adb shell dumpsys alarm | grep -A3 DAY_ROLLOVER`.
  - Adding a widget: long-press the home screen → Widgets → search "Trackbit" → tap the entry → tap the preview → "Add". Find the coordinates with `uiautomator dump`.
- The emulator is signed in as a different local user (habits "Check", "Morning Run", "Otroer", "Timed", "Ejercicio"), not the B10 smoke user. Its password isn't recorded, so sign-out wasn't tested for W1 or W3. A W3 widget (4×2, "Check") is on the home screen; its habit has logs from May, which show the history pull. The W1 widget is no longer on the first page.
- **The backend's history endpoint is `/days`, not `/history`.** A backend that isn't running the C4 code answers 404, which the app treats as `Failed`: W3 then shows only the last week.
- **`uiautomator dump` fails ("could not get idle state") while a chronometer is ticking** on screen (widget or notification shade). Use screenshots, or stop the timer first.
- **Widget UI helper:** find a node's center with `uiautomator dump` and grep its bounds (text or content-desc). The launcher's resize handles sit at the middle of each edge; dragging one about 300 px changes the size by one cell.

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug --max-workers=2   # green, 0 lint issues, 202 tests
pnpm android:generate:check                                          # 19 generated files up to date
pnpm --filter backend test                                           # 56 tests (re-record contracts: test:contracts:update)
```

## Open questions

- **Deferred, non-blocking items** (the post-reinstall tap oddity, picker polish, device checks for W1's offline, midnight, signed-out and removed states) are in [kotlin-app-followups.md](../tasks/kotlin-app-followups.md). Add to it rather than to this handoff.
- Release URL, targetSdk 37 and first CI run: unchanged from the B handoff.

## Run log

- 2026-09-28 — C1: widget foundation (Glance 1.2.0, `WidgetDay` + midnight alarm, `WidgetUpdater` + `TrackerRepository.changes`, theme, actions) and W2 Today list; verified on the emulator (online/offline logging without duplicates, midnight, sign-out/in, toggle). Moved all Robolectric tests from API 23 to 36 (user decision), which exposed and fixed a `SessionStore.currentToken()` race. Next: C2.
- 2026-09-29 — C2: W1 quick-log (config activity, responsive 1×1/2×1/2×2, bitmap progress ring, 7-day strip, removed/unconfigured states) plus shared `logAction`/`detailsText`. Verified on the emulator: placement, +1 at every size, reconfigure on a live session, resize. Found and fixed Glance's 10-child limit dropping strip cells. Next: C3.
- 2026-09-29 — C3: timer engine (`timers` table, Room v2 auto-migration, start/stop/+30s in `TrackerRepository`, stop = increment in one transaction), `TimerNotifier` + Stop/+30s receiver in `app` with no foreground service, one-time notification permission, timed start/stop with a live chronometer in W1 and W2. Verified on the emulator: start from W1, survives reinstall, +30s, stop from the notification and from W1 reach the server as increments. Next: C4.
- 2026-09-29 — C4: backend `GET /api/tracker/days` (user chose it over `/history`) + contract; Room v3 `history` request with pulls in `TrackerSync` (due/stale logic, `HistoryWorker`, release on the last W3's removal); W1's picker and state generalized into `habit/` for W1 and W3; W3 heatmap (26-week window, exact-size grid, tinted cells). Verified on the emulator: placing W3 via the picker, with the cells matching the server's logs back to May. Next: C5.
- 2026-10-02 — C5 previews: generated previews (Android 15+, `providePreview` + `WidgetPreviews`, republished on update and locale change) and static `previewLayout`s (12+) with sample habits. Fixed W3's view count (one view per day) and its dark low-end colors. Verified on the emulator: the picker in light and dark, both kinds of preview, and a placed W3 in light and dark. Real-device check deferred to the end (user). 202 tests.
