# Kotlin app — deferred follow-ups

Small issues and checks found while building the [Kotlin app](kotlin-app.md) that don't block using it. They were deferred on purpose so each run stays on the plan. Pick them up after Phase 1, or earlier if one starts to matter.

Add an item when you defer something. Delete it once it's done or no longer relevant. Anything that blocks a phase's exit, or a release, belongs in the handoff instead.

## To investigate

- **A widget tap right after reinstalling opened the app instead of logging** (W1, 2026-09-29). This happened once, within seconds of `installDebug` and before Glance had re-rendered the widget. Every tap after that worked. Check whether it happens on a real device after a normal update (not only with `adb install`), and whether W2 does the same. If only stale RemoteViews are to blame, there's nothing to fix.

## To check on a device

These are covered by unit tests but were not exercised on the emulator for W1. Run through them during the C5 real-device pass:

- W1 offline: a tap updates at once and reaches the server exactly once after reconnecting.
- W1 at midnight: it moves to the next day (the 7-day strip shifts).
- W1 signed out shows "Sign in" / "Sign in to Trackbit…". After signing in again with the same account, the widget shows its habit again.
- W1 "Habit removed": delete the habit on the web, sync, and the widget offers to choose another. The tap opens the picker for that widget.
- W1 and W2 in dark mode and without dynamic color (API < 31).

## Polish

- **The W1 picker doesn't mark the current habit when reconfiguring.** It would need the widget's Glance state read in `QuickLogConfigViewModel`.
- **The W1 7-day strip doesn't mark an anti-habit's clean days**, only slips. `TrackedHabit` doesn't carry `firstLogDay`, so a clean day can't be told apart from a day before tracking started. Expose it from `core:data` if the strip should show clean days.
- **The ring arc is a fixed 288 px bitmap.** It's sharp at 2×2 on xxxhdpi. Size it from the widget's actual size if a larger layout is ever added.

## Housekeeping

- **Local smoke user** `b10-smoke@example.com` exists in the local dev DB only. Delete it when it's no longer useful.
- **Timezones:** the web tracker takes "today" from the browser's timezone, and the app and widgets use the stored one. The plan's §6 proposal isn't built. Revisit if users travel across timezones and see mismatched days.
