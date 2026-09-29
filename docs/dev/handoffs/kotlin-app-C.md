# Handoff: Kotlin app — Workstream C (widgets)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §2.2 and §4 "Phase 1". Phase 0 context (core modules, their invariants, landmines) is in [kotlin-app-B.md](kotlin-app-B.md): read its "Invariants" and "Landmines" sections, nothing else.
- **Status:** Phase 1 — C1, C2 and C3 of C1–C5 done (widget foundation, W2 Today list, W1 quick-log, timer engine). Next is C4 (W3 heatmap).
- **Branch:** `kotlin-app` · **Last run:** 2026-09-29 (C3 uncommitted at end of run)

## Where we are

W2 (Today list) works end to end on the emulator (API 36, Pixel Launcher, local backend): dynamic color, check toggle, count +1, offline taps reach the server exactly once after reconnecting, midnight rollover, sign-out/in. W1 (quick-log) works on the emulator too: placing it opens the habit picker, and a tap logs +1 at 2×1, 2×2 and 1×1 (checked on the server). Reconfiguring with the launcher's pencil switches the habit on a live session, and resizing switches the layout. Not verified on the emulator for W1: the offline, midnight, signed-out and habit-removed states (unit-tested; queued in [kotlin-app-followups.md](../tasks/kotlin-app-followups.md) for the C5 device pass). Timed habits (C3) work on the emulator too: a W1 tap starts a timer, the widget shows a live chronometer against the goal, and an ongoing notification appears with Stop / +30s. The timer survived a reinstall, +30s moved it forward, and Stop from either the notification or the widget added the elapsed ms to the server's day log (a second session added to the first). The 1→2 Room migration kept the emulator's data. `./gradlew assembleDebug testDebugUnitTest lintDebug` passes with 0 lint issues and 174 unit tests (13 new). Not done yet: W3, widget previews, a real-device run.

## Phase 1 task split (C1–C5)

| Task | Scope | Status |
|---|---|---|
| **C1** | Glance setup, `WidgetDay` + midnight alarm, `WidgetUpdater`, theme, W2 with signed-out/empty/frozen/error states | ✅ 2026-09-28 |
| **C2** | W1 habit quick-log: config activity (habit picker), 1×1 / 2×1 / 2×2 (`SizeMode.Responsive`), progress ring + streak, 7-day strip at 2×2; check/count only | ✅ 2026-09-29 |
| **C3** | Timer engine in `core:data` (persisted start + duration), ongoing Chronometer notification (Stop / +30s), timed habits start/stop in W1 and W2 | ✅ 2026-09-29 |
| **C4** | W3 heatmap + config activity. Needs history beyond Room's 7 days: `/api/tracker/history` service + storage | next |
| **C5** | Previews (`previewLayout` < 35, generated previews 35+), final exit check on a real device | |

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

## Next: C4 — W3 heatmap

1. `/api/tracker/history` (`start`/`end` on `local_day`) service in `core:network` + storage for more than Room's 7 days (a history table, or widen `day_logs`; keep the pending-op guard in `SyncDao`).
2. W3 (4×2, 4×3): last N weeks on the habit's gradient, the web `Heatmap` scale (`colorStops.colorAt`). Read-only; a tap opens the app (analytics comes in Phase 2). Config activity: reuse W1's picker.
3. Remember Glance's 10-children limit per Row/Column: a week column of 7 is fine, but a row of N weeks needs chunking or a bitmap.

## Invariants — do not break these

(Plus every invariant in [kotlin-app-B.md](kotlin-app-B.md#invariants--do-not-break-these).)

- **Widgets never call the network or DAOs.** Reads: `TrackerRepository.observeDay/observeHabit`. Writes: `TrackerRepository` actions. Refresh: `WidgetUpdater`, driven by `changes`.
- **Widget composables collect their flows inside `provideContent`.** A value captured in `provideGlance` goes stale on a live session.
- **The widget day comes from `WidgetDay.today`**, never `LocalDate.now()` in a composable, and writes use the row's `TrackedHabit.day`.
- **Every widget is listed in `TrackbitWidgets.all()`**, or it misses rollover and data refreshes.
- **Per-widget Glance state holds only the user's choice** (W1's habit id). Everything it shows is derived from Room, so deletion and sign-out need no cleanup.
- **What a tap logs comes from `logAction(habit)`**, for every widget.
- **Hilt reaches Glance classes only through `WidgetEntryPoint`** (Glance instantiates widgets, receivers and callbacks itself). The entry point must stay public.
- **Strings come from `com.trackbit.core.i18n.R`**, not the widget's `R` (R classes are non-transitive).
- **A timer is a stored start instant, never a ticking count.** Stopping it deletes the row and logs in the same transaction.
- **Timer notifications follow Room** (`TimerNotifier`). Never post or cancel them from an action: change the timer and let the reconciler catch up.

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

- **Glance drops a Row's or Column's children past the tenth** (it only logs). W1's 7-day strip first used Spacers between cells (13 children) and lost today's cell. Use padding for gaps.
- **Robolectric runs on targetSdk (36) because the library convention sets `isIncludeAndroidResources = true`.** Without it, Robolectric can't read the manifest and falls back to API 23, below minSdk. That was the state until C1 (probe-tested). Don't remove it. Pin a single test with `@Config(sdk = …)` only when an API-specific behaviour matters.
- **Robolectric on API 36 needs `--add-exports=java.base/jdk.internal.access=ALL-UNNAMED`** (it creates `ApplicationSharedMemory` through FileDescriptor internals). Added once for every module in [KotlinAndroid.kt](../../../apps/android/build-logic/convention/src/main/kotlin/com/trackbit/buildlogic/KotlinAndroid.kt).
- **Glance test matchers:** the click action sits on the container, the text or description on its child. Match `hasClickAction… and hasAnyDescendant(hasText…)`. `openAppAction` needs a launcher activity: tests register one with `shadowOf(packageManager)`.
- **Glance runs `provideGlance` as a WorkManager worker** through the app's `Configuration.Provider`. `CancelSyncOnSignOut` cancels only the `tracker-sync` tag, so it doesn't touch Glance's work. Keep it that way.
- **Emulator:**
  - Setting the clock: `date` is refused on the Play image, even after `adb root`. Use `adb shell settings put global auto_time 0` and `adb shell cmd alarm set-time <epoch ms>`. Restore with `auto_time 1`. Inspect the alarm with `adb shell dumpsys alarm | grep -A3 DAY_ROLLOVER`.
  - Adding a widget: long-press the home screen → Widgets → search "Trackbit" → tap the entry → tap the preview → "Add". Find the coordinates with `uiautomator dump`.
- The emulator is signed in as a different local user (habits "Check", "Morning Run", "Otroer", "Timed", "Ejercicio"), not the B10 smoke user. Its password isn't recorded, so sign-out wasn't tested for W1. A W1 widget (1×1, "Otroer") is on the home screen.
- **`uiautomator dump` fails ("could not get idle state") while a chronometer is ticking** on screen (widget or notification shade). Use screenshots, or stop the timer first.
- **Widget UI helper:** find a node's center with `uiautomator dump` and grep its bounds (text or content-desc). The launcher's resize handles sit at the middle of each edge; dragging one about 300 px changes the size by one cell.

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug --max-workers=2   # green, 0 lint issues, 174 tests
pnpm android:generate:check                                          # 19 generated files up to date
```

## Open questions

- **Deferred, non-blocking items** (the post-reinstall tap oddity, picker polish, device checks for W1's offline, midnight, signed-out and removed states) are in [kotlin-app-followups.md](../tasks/kotlin-app-followups.md). Add to it rather than to this handoff.
- Release URL, targetSdk 37 and first CI run: unchanged from the B handoff.

## Run log

- 2026-09-28 — C1: widget foundation (Glance 1.2.0, `WidgetDay` + midnight alarm, `WidgetUpdater` + `TrackerRepository.changes`, theme, actions) and W2 Today list; verified on the emulator (online/offline logging without duplicates, midnight, sign-out/in, toggle). Moved all Robolectric tests from API 23 to 36 (user decision), which exposed and fixed a `SessionStore.currentToken()` race. Next: C2.
- 2026-09-29 — C2: W1 quick-log (config activity, responsive 1×1/2×1/2×2, bitmap progress ring, 7-day strip, removed/unconfigured states) plus shared `logAction`/`detailsText`. Verified on the emulator: placement, +1 at every size, reconfigure on a live session, resize. Found and fixed Glance's 10-child limit dropping strip cells. Next: C3.
- 2026-09-29 — C3: timer engine (`timers` table, Room v2 auto-migration, start/stop/+30s in `TrackerRepository`, stop = increment in one transaction), `TimerNotifier` + Stop/+30s receiver in `app` with no foreground service, one-time notification permission, timed start/stop with a live chronometer in W1 and W2. Verified on the emulator: start from W1, survives reinstall, +30s, stop from the notification and from W1 reach the server as increments. Next: C4.
