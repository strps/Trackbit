# Kotlin app — deferred follow-ups

Small issues and checks found while building the [Kotlin app](kotlin-app.md) that don't block using it. They were deferred on purpose so each run stays on the plan. Pick them up after Phase 1, or earlier if one starts to matter.

Add an item when you defer something. Delete it once it's done or no longer relevant. Anything that blocks a phase's exit, or a release, belongs in the handoff instead.

## To investigate

- **A widget tap right after reinstalling opened the app instead of logging** (W1, 2026-09-29). This happened once, within seconds of `installDebug` and before Glance had re-rendered the widget. Every tap after that worked. Check whether it happens on a real device after a normal update (not only with `adb install`), and whether W2 does the same. If only stale RemoteViews are to blame, there's nothing to fix.
- **The launcher once placed a habit widget without opening its picker** (W3, 2026-10-02). Within a minute of `adb install`, tapping "Add" put the widget down and removed it again ("appWidgetId was not returned from the widget configuration activity"), and `HabitPickerActivity` never started. The next try opened the picker as usual. It may be the same post-install timing as the item above; check after a normal update on a device.

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
- Timers: the notification reappears after a reboot once anything wakes the app (widget update); swiping it away on 14+ leaves the timer running in the widgets; denying the notification permission leaves timers working in the widgets.

## Polish

- **The W1 picker doesn't mark the current habit when reconfiguring.** It would need the widget's Glance state read in `QuickLogConfigViewModel`.
- **The W1 7-day strip doesn't mark an anti-habit's clean days**, only slips. `TrackedHabit` doesn't carry `firstLogDay`, so a clean day can't be told apart from a day before tracking started. Expose it from `core:data` if the strip should show clean days.
- **W3 has no month or weekday labels and no today marker** (the web has all three). Glance's 10-child limit makes a label row that lines up with the week columns awkward; a small bitmap or a label column would do it.
- **The W1 7-day strip draws a day's color straight on the widget background**, not over an empty cell as W3 and the web do. The gradient's low end is mostly transparent, so a lightly logged day looks fainter than an empty one. Put the colored bar over the `surfaceVariant` one (one more view per day; there are only seven).
- **No widget previews on Android 8–11** (API 26–30): `previewLayout` needs 12+, so the picker shows the app icon there. A `previewImage` per widget (rendered images, fixed theme and language) would cover it.
- **The ring arc is a fixed 288 px bitmap.** It's sharp at 2×2 on xxxhdpi. Size it from the widget's actual size if a larger layout is ever added.

- **Chronometer format differs from ours:** the RemoteViews/notification chronometer shows "02:53", while `formatDuration` writes "1:00" (no leading zero). A `Chronometer` format string can't drop the zero. Live with it, or format the goal the same way.
- **The app's Today screen has no timer controls** yet: timed rows show only progress. Phase 2's tracker home adds them (the notification's tap opens the app, where the running timer isn't visible yet).

## Housekeeping

- **Local smoke user** `b10-smoke@example.com` exists in the local dev DB only. Delete it when it's no longer useful.
- **Timezones:** the web tracker takes "today" from the browser's timezone, and the app and widgets use the stored one. The plan's §6 proposal isn't built. Revisit if users travel across timezones and see mismatched days.
