# Kotlin app — deferred follow-ups

Small issues and checks found while building the [Kotlin app](kotlin-app.md) that don't block using it. They were deferred on purpose so each run stays on the plan. Pick them up after Phase 1, or earlier if one starts to matter.

Add an item when you defer something. Delete it once it's done or no longer relevant. Anything that blocks a phase's exit, or a release, belongs in the handoff instead.

## To investigate

- **A widget tap right after reinstalling opened the app instead of logging** (W1, 2026-09-29). This happened once, within seconds of `installDebug` and before Glance had re-rendered the widget. Every tap after that worked. Check whether it happens on a real device after a normal update (not only with `adb install`), and whether W2 does the same. If only stale RemoteViews are to blame, there's nothing to fix.
- **The launcher once placed a habit widget without opening its picker** (W3, 2026-10-02). Within a minute of `adb install`, tapping "Add" put the widget down and removed it again ("appWidgetId was not returned from the widget configuration activity"), and `HabitPickerActivity` never started. The next try opened the picker as usual. It may be the same post-install timing as the item above; check after a normal update on a device.

- **The web treats `exercise_log.duration` as milliseconds** (`ExerciseLogCard`'s flexibility legend divides it by 1000), while the Android model documents seconds (D3's hold summary multiplies by 1000). No client writes it yet; settle the unit before one does.

## To check on a device

These are covered by unit tests but were not exercised on the emulator for W1. Run through them during the C5 real-device pass:

- W1 offline: a tap updates at once and reaches the server exactly once after reconnecting.
- W1 at midnight: it moves to the next day (the 7-day strip shifts).
- W1 signed out shows "Sign in" / "Sign in to Trackbit…". After signing in again with the same account, the widget shows its habit again.
- W1 "Habit removed": delete the habit on the web, sync, and the widget offers to choose another. The tap opens the picker for that widget.
- W1 and W2 in dark mode and without dynamic color (API < 31), including the timer text (`widget_timer_text`).
- W2 timed rows: the play/stop button and the running chronometer (only W1 was exercised for timers).
- W3: removing the last heatmap releases history (the `history` row goes, logs older than a week are dropped, no more `/days` pulls). Also a 4×3 size (dark mode was checked on the emulator in C5), and a running timer in the header (its chronometer shares the row with the name).
- Previews (C5): after switching the device language, the picker's generated previews (Android 15+) show the new language (`LOCALE_CHANGED` republishes them); after an update they come back (an update clears them, `MY_PACKAGE_REPLACED` republishes). If the system refuses a publish (rate limit), the static `previewLayout` shows until the next app start.
- Tracker (D1): check rows (toggle with the accent fill), anti-habit rows and section, a frozen habit (lock, disabled controls, snackbar), and the tracker in Spanish. The emulator account has none of these.
- Timers: the notification reappears after a reboot once anything wakes the app (widget update); swiping it away on 14+ leaves the timer running in the widgets; denying the notification permission leaves timers working in the widgets.
- Session screen (D3): offline logging of a whole workout (start, add exercise, sets, edits) reaching the server once and in order after reconnecting; a frozen habit's session (read-only banner, no controls); a frozen custom exercise in the picker (locked) and in a log; imperial units (pounds, 5 lb steps); a flexibility exercise (the emulator catalog has none); Spanish.

## Polish

- **The W1 picker doesn't mark the current habit when reconfiguring.** It would need the widget's Glance state read in `QuickLogConfigViewModel`.
- **The W1 7-day strip doesn't mark an anti-habit's clean days**, only slips. `TrackedHabit` doesn't carry `firstLogDay`, so a clean day can't be told apart from a day before tracking started. Expose it from `core:data` if the strip should show clean days.
- **W3 has no month or weekday labels and no today marker** (the web has all three). Glance's 10-child limit makes a label row that lines up with the week columns awkward; a small bitmap or a label column would do it.
- **The W1 7-day strip draws a day's color straight on the widget background**, not over an empty cell as W3 and the web do. The gradient's low end is mostly transparent, so a lightly logged day looks fainter than an empty one. Put the colored bar over the `surfaceVariant` one (one more view per day; there are only seven).
- **No widget previews on Android 8–11** (API 26–30): `previewLayout` needs 12+, so the picker shows the app icon there. A `previewImage` per widget (rendered images, fixed theme and language) would cover it.
- **The ring arc is a fixed 288 px bitmap.** It's sharp at 2×2 on xxxhdpi. Size it from the widget's actual size if a larger layout is ever added.

- **Chronometer format differs from ours:** the RemoteViews/notification chronometer shows "02:53", while `formatDuration` writes "1:00" (no leading zero). A `Chronometer` format string can't drop the zero. Live with it, or format the goal the same way.
- **Tracker rows reserve an empty badge line** (D1) so a first badge doesn't move the buttons; rows without badges have blank space at the bottom. The web puts badges on the accent edge with a fixed row height; something similar would be tighter.
- **Tracker: no swipe between days**, only ‹ › and the picker.
- **Set edits aren't coalesced** (D3): every stepper tap or RPE change queues its own full-value `UpdatePerformance`, as the web sends one PATCH per change. Correct (FIFO, last write wins) but chatty; merge a pending update into the next one for the same set if it ever matters.
- **The lap/hold stopwatch lives on the screen** (D3, like the web's): it survives rotation but not leaving the screen, and nothing is saved until pause. Moving it onto the timer engine (as D5 does for rest) would make it survive.
- **Only the play button opens a workout row's session** (D1/D3); tapping the rest of the row does nothing.
- **No "add to list" in the picker** (D4): the web's rows have `AddToListMenu` (`capabilities.canAppend`). It edits lists, which the app can't do yet; add it with the lists screen (Phase 3). Likewise the "No lists yet" hint is disabled instead of opening a list editor.
- **System-named sources show "Source"** (D4): no source has a `nameKey` yet. When programs bring one ("today's routine"), map its key to a string in `sourceName` (`ExercisePicker.kt`).
- **The web's flexibility card can't start a hold** (no add button when a log has no set); the app adds one with "Start" (D3). Give the web the same.
- **Rest notification and alert open the app's home, not the session** (D5). A deep link to `session/{habitId}/{day}` would need the rest timer to remember its session (a column, or the last log's day).
- **The exact-alarm hint is re-checked only on resume** (D5): after granting it through `adb appops` (no resume), the hint stays until the screen resumes. Granting it in Settings resumes the screen, so users won't see this.
- **No in-app alert without notification permission** (D5): with `POST_NOTIFICATIONS` denied, the end of a rest is silent. Vibrating from the session screen when it's in the foreground would cover that case.
- **Adding a set in compact cards opens the set editor sheet over the rest bar** (D5); the countdown shows once the sheet closes.

## Housekeeping

- **`@trackbit/types` has no `uuid` on sessions, logs and sets** (D2 added the column). The web ignores it; its optimistic rows use negative temp ids. Adopting client uuids on the web too would let it drop the temp-id swapping in `useActivityTracker.ts`, and then the types should carry `uuid`.
- **Session rows stay in Room for every day the app opened** (D2), until sign-out. Small, but never pruned; prune days older than the history window if it ever matters.
- **Deleting a session, log or set isn't gated on frozen habits** on the server (creates and edits are). Same as before D2; decide whether deletes of frozen data should be allowed.
- **A preferred-source change made offline is lost** (D4): `PreferencesRepository` updates the cached user and PATCHes once; if the PATCH fails, the next session refresh brings the server's value back. Queue it (outbox or a retrying worker) if that bites.
- **Prescribed weights aren't converted** (D4, same as the web's `buildNewSetValues`): a prescription is in the exercise's `defaultWeightUnit`, but sets store kg, so a `lbs` exercise's target weight is taken as kg. Fix on both clients (or store prescriptions in kg) once there is a prescription editor.
- **A prescription is found only while a cached queue holds its list item** (D4): a log picked from a list on the web, whose list the app never resolved, starts its sets from the last performance. Pulling every list's queue (or `GET /exercise-lists`) would cover it.
- **A day's sessions refresh only when asked** (`SessionRepository.refresh`: the session screen on open and on pull-to-refresh). A session added on the web shows in the app's session count (via `/today`) before its contents.

- **The tracker's history request can outlive the screen** (D1): if the app closes while a past day is shown, the request stays (periodic sync pulls it every 6 h) until the tracker screen starts again and releases it. Releasing from `onCleared` would need an app-wide scope in features.

- **Local smoke user** `b10-smoke@example.com` exists in the local dev DB only. Delete it when it's no longer useful.
- **Timezones:** the web tracker takes "today" from the browser's timezone, and the app and widgets use the stored one. The plan's §6 proposal isn't built. Revisit if users travel across timezones and see mismatched days.
