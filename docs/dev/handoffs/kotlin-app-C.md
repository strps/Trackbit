# Handoff: Kotlin app — Workstream C (widgets)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §2.2 and §4 "Phase 1". Phase 0 context (core modules, their invariants, landmines) is in [kotlin-app-B.md](kotlin-app-B.md): read its "Invariants" and "Landmines" sections, nothing else.
- **Status:** Phase 1 — C1 of C1–C5 done (widget foundation + W2 Today list). Next is C2 (W1 quick-log).
- **Branch:** `kotlin-app` · **Last run:** 2026-09-28 (uncommitted at end of run)

## Where we are

W2 (Today list) works end to end on the emulator (API 36, Pixel Launcher, local backend): it renders with dynamic color, check rows toggle, count rows +1, a tap while offline updates the widget at once and reaches the server exactly once after reconnecting, the midnight alarm moves it to the next day, sign-out shows the sign-in message and sign-in fills it again. `./gradlew assembleDebug testDebugUnitTest lintDebug` passes with 0 lint issues and 152 unit tests (11 new in `widget`, 1 in `core:auth`). Every Robolectric test runs on API 36 (targetSdk). Not done yet: W1, W3, the timer engine, widget previews, a real-device run.

## Phase 1 task split (C1–C5)

| Task | Scope | Status |
|---|---|---|
| **C1** | Glance setup, `WidgetDay` + midnight alarm, `WidgetUpdater`, theme, W2 with signed-out/empty/frozen/error states | ✅ 2026-09-28 |
| **C2** | W1 habit quick-log: config activity (habit picker), 1×1 / 2×1 / 2×2 (`SizeMode.Responsive`), progress ring + streak, 7-day strip at 2×2; check/count only | next |
| **C3** | Timer engine in `core:data` (persisted start + duration), ongoing Chronometer notification (Stop / +30s), timed habits start/stop in W1 and W2 | |
| **C4** | W3 heatmap + config activity. Needs history beyond Room's 7 days: `/api/tracker/history` service + storage | |
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

## Next: C2 — W1 habit quick-log

1. Create `widget/.../quicklog/QuickLogWidget.kt` + receiver, and add it to `TrackbitWidgets.all()`. It needs **per-instance state** (the chosen habit id): use Glance's `PreferencesGlanceStateDefinition` (the default), unlike W2.
2. Config activity (`android:configure` in the provider XML, `widgetFeatures="reconfigurable"`; not `configuration_optional`, since W1 needs a habit): a Compose list of `TrackerRepository.observeDay(today)` habits; on pick, write the id into the Glance state, `update`, and `setResult(RESULT_OK)`. It lives in `widget` (widgets never depend on features).
3. Content by size (`SizeMode.Responsive` with 1×1, 2×1, 2×2): progress ring (Glance has no ring: draw with `CircularProgressIndicator` or a bitmap), streak, 7-day strip from `TrackedHabit.recent` at 2×2. Tap = the C1 actions; timed/complex open the app until C3.
4. States: habit deleted (`observeHabit` → null) → "Habit removed, tap to choose another" opening the config activity; frozen; signed out.
5. Reuse `todayWidgetState`'s pattern (auth → day → repository) for a per-habit state flow.

## Invariants — do not break these

(Plus every invariant in [kotlin-app-B.md](kotlin-app-B.md#invariants--do-not-break-these).)

- **Widgets never call the network or DAOs.** Reads: `TrackerRepository.observeDay/observeHabit`. Writes: `TrackerRepository` actions. Refresh: `WidgetUpdater`, driven by `changes`.
- **Widget composables collect their flows inside `provideContent`.** A value captured in `provideGlance` goes stale on a live session.
- **The widget day comes from `WidgetDay.today`**, never `LocalDate.now()` in a composable, and writes use the row's `TrackedHabit.day`.
- **Every widget is listed in `TrackbitWidgets.all()`**, or it misses rollover and data refreshes.
- **Hilt reaches Glance classes only through `WidgetEntryPoint`** (Glance instantiates widgets, receivers and callbacks itself). The entry point must stay public.
- **Strings come from `com.trackbit.core.i18n.R`**, not the widget's `R` (R classes are non-transitive).

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

- **Robolectric runs on targetSdk (36) because the library convention sets `isIncludeAndroidResources = true`.** Without it, Robolectric can't read the manifest and falls back to API 23, below minSdk. That was the state until C1 (probe-tested). Don't remove it. Pin a single test with `@Config(sdk = …)` only when an API-specific behaviour matters.
- **Robolectric on API 36 needs `--add-exports=java.base/jdk.internal.access=ALL-UNNAMED`** (it creates `ApplicationSharedMemory` through FileDescriptor internals). Added once for every module in [KotlinAndroid.kt](../../../apps/android/build-logic/convention/src/main/kotlin/com/trackbit/buildlogic/KotlinAndroid.kt).
- **Glance test matchers:** the click action sits on the container, the text or description on its child. Match `hasClickAction… and hasAnyDescendant(hasText…)`. `openAppAction` needs a launcher activity: tests register one with `shadowOf(packageManager)`.
- **Glance runs `provideGlance` as a WorkManager worker** through the app's `Configuration.Provider`. `CancelSyncOnSignOut` cancels only the `tracker-sync` tag, so it doesn't touch Glance's work. Keep it that way.
- **Emulator:**
  - Setting the clock: `date` is refused on the Play image, even after `adb root`. Use `adb shell settings put global auto_time 0` and `adb shell cmd alarm set-time <epoch ms>`. Restore with `auto_time 1`. Inspect the alarm with `adb shell dumpsys alarm | grep -A3 DAY_ROLLOVER`.
  - Adding a widget: long-press the home screen → Widgets → search "Trackbit" → tap the entry → tap the preview → "Add". Find the coordinates with `uiautomator dump`.
- The emulator's persisted session was a different local user (habits "Check", "Morning Run"), not the B10 smoke user. The smoke user is signed in now.

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug --max-workers=2   # green, 0 lint issues, 152 tests
pnpm android:generate:check                                          # 19 generated files up to date
```

## Open questions

- **Timed habits in W2** show "0:00 / 10:00" and open the app until C3.
- Release URL, targetSdk 37 and first CI run: unchanged from the B handoff.

## Run log

- 2026-09-28 — C1: widget foundation (Glance 1.2.0, `WidgetDay` + midnight alarm, `WidgetUpdater` + `TrackerRepository.changes`, theme, actions) and W2 Today list; verified on the emulator (online/offline logging without duplicates, midnight, sign-out/in, toggle). Moved all Robolectric tests from API 23 to 36 (user decision), which exposed and fixed a `SessionStore.currentToken()` race. Next: C2.
