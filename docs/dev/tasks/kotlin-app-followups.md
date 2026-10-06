# Kotlin app — deferred follow-ups

Small issues and checks found while building the [Kotlin app](kotlin-app.md) that don't block using it. They were deferred on purpose so each run stays on the plan. Pick them up after Phase 1, or earlier if one starts to matter.

Add an item when you defer something. Delete it once it's done or no longer relevant. Anything that blocks a phase's exit, or a release, belongs in the handoff instead.

## To investigate

- **A widget tap right after reinstalling opened the app instead of logging** (W1, 2026-09-29). This happened once, within seconds of `installDebug` and before Glance had re-rendered the widget. Every tap after that worked. Check whether it happens on a real device after a normal update (not only with `adb install`), and whether W2 does the same. If only stale RemoteViews are to blame, there's nothing to fix.
- **The launcher once placed a habit widget without opening its picker** (W3, 2026-10-02). Within a minute of `adb install`, tapping "Add" put the widget down and removed it again ("appWidgetId was not returned from the widget configuration activity"), and `HabitPickerActivity` never started. The next try opened the picker as usual. It may be the same post-install timing as the item above; check after a normal update on a device.

- **The web treats `exercise_log.duration` as milliseconds** (`ExerciseLogCard`'s flexibility legend divides it by 1000), while the Android model documents seconds (D3's hold summary multiplies by 1000). No client writes it yet; settle the unit before one does.

- **The local backend's `tsx watch` can miss an edit** (E3, 2026-10-05). The dev server that started at 11:50:40 kept serving the old exercise routes after a save at 11:50:43, and stayed stale for two days; touching the file didn't wake it. If a backend change "doesn't work" on the emulator, compare the process start time with the file's mtime (`ps -o lstart= -p <pid>`) and restart `pnpm dev:backend`.
- **The web library still has no muscle group filter** (E3). Android filters by top-level group (subdivisions included); add the same chips to `ExerciseLibrary.tsx` when the web gets touched.

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
- Habits config (E1): a frozen habit (banner, Save off, Delete on, lock instead of the drag handle), a role without timed/check (locked type cards), the cap (add button explains), Spanish, dark mode. The emulator account is an admin with no frozen habits.
- Account (E2): a successful password change (the app adopts the new token, other sessions end, nothing is cleared). Backend and unit tests cover it; the emulator's dev account password isn't recorded, so only a wrong current password was tried there. Use `b10-smoke@example.com` and put its password back afterwards. Also the units and card style choices, dark mode, and the per-app language on Android 8–12 (AppCompat's stored locale, not the system's).
- Session screen (D3): offline logging of a whole workout (start, add exercise, sets, edits) reaching the server once and in order after reconnecting; a frozen habit's session (read-only banner, no controls); a frozen custom exercise in the picker (locked) and in a log; imperial units (pounds, 5 lb steps); a flexibility exercise (the emulator catalog has none); Spanish.

## Polish

- **Reset and verification links open the web, not the app** (E5). Both emails link to the web (`/reset-password?token=`, `/verify-email?backendUrl=`), which works from any device; the app only asks for them. Opening them in the app needs Android App Links: `/.well-known/assetlinks.json` on the web host with the release (Play signing) certificate, an intent filter, and a reset screen in `feature/auth`.
- **The web's sign-in doesn't offer to resend the verification email** (E5): it shows Better-Auth's message only, and resending lives on `/verify-email`'s error state. The app offers the button right under `EMAIL_NOT_VERIFIED`; give the web the same.

- **On Android 8–12, widgets and notifications stay in the system language** after switching the app's language (E2). AppCompat localizes activities only there; from 13 the system localizes the whole process. Fixing it means wrapping the widget/notification `Context` with the app locale.
- **Account settings lack the web's profile image URL and "Delete account"** (E2). The image needs an image loader (none in the app yet); the web's delete button is a placeholder with no endpoint.
- **The preferred exercise source isn't in Account settings** (E2): the session picker sets it, as on the web, which doesn't list it in account settings either.

- **The W1 picker doesn't mark the current habit when reconfiguring.** It would need the widget's Glance state read in `QuickLogConfigViewModel`.
- **The W1 7-day strip doesn't mark an anti-habit's clean days**, only slips (the analytics heatmap neither, D6). `TrackedHabit.firstLogDay` exists since D6, so a clean day can now be told apart from a day before tracking started.
- **W3 has no month or weekday labels and no today marker** (the web has all three). Glance's 10-child limit makes a label row that lines up with the week columns awkward; a small bitmap or a label column would do it.
- **The W1 7-day strip draws a day's color straight on the widget background**, not over an empty cell as W3 and the web do. The gradient's low end is mostly transparent, so a lightly logged day looks fainter than an empty one. Put the colored bar over the `surfaceVariant` one (one more view per day; there are only seven).
- **No widget previews on Android 8–11** (API 26–30): `previewLayout` needs 12+, so the picker shows the app icon there. A `previewImage` per widget (rendered images, fixed theme and language) would cover it.
- **The ring arc is a fixed 288 px bitmap.** It's sharp at 2×2 on xxxhdpi. Size it from the widget's actual size if a larger layout is ever added.

- **The gradient editor's end handles hang half off the bar** (E1): a stop at 0 or 1 is centred on the bar's edge. Inset the track by half a handle.
- **The habit form loses unsaved edits on process death and on Back** (E1): the form lives in the ViewModel, not `SavedStateHandle`, and Back (or the edge gesture) closes it without asking, like the web's drawer. Save the form state, or confirm discarding a dirty form.
- **Habit reorder is drag-only** (E1): no move up/down actions for TalkBack. Add custom accessibility actions on each row.

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

- **The stacked volume chart's exercise colors differ from the web's** (F2). The web orders exercises by int id, which the app no longer has, so the app orders them by first logged set: the same exercise may get another color on each client. Matching would need a shared, id-free order (e.g. by `exercises.created_at`, sent in `/sets`).

## Housekeeping

- **Invites aren't tied to their email** (E5): the admin route always stores the recipient in `invites.email`, but sign-up accepts the code with any email. Decide whether a code should only work for its recipient (case-insensitive match in `consumeInvite`, `auth.ts`).
- **An invite's use is taken before the user row is inserted** (E5, unchanged): the conditional UPDATE runs in Better-Auth's `create.before` hook, so an insert that fails afterwards (a DB error; a taken email is refused earlier) loses that use. Accounts that never verify keep theirs too.
- **`errors.json`'s `invite_code_required` is unused** (sign-up treats a code as optional); drop it, or add a server-side "invite required" setting if registration should close again.

- **The web has no prescription editor** (E4, Android only, user): the web's list editor still edits only order and membership; its round-trip keeps the targets the app writes. Add the fields there (kg/km, the server's bounds in `exercise-lists.ts`) when the programs phase comes.
- **`exercise_list_items_list_position_uq` isn't deferrable on the local dev DB** although `0006` asks for it (and a pushed schema never is). Since E4 the route writes positions in two phases and doesn't need it; check production with `SELECT condeferrable FROM pg_constraint WHERE conname = 'exercise_list_items_list_position_uq'` and drop the `DEFERRABLE` expectation from the docs if it differs.
- **The web's `PATCH /api/tracker/exercise-logs/:id` answers without `exerciseUuid`/`listItemUuid`** (F2): it's the generic CRUD router, which has no after-update hook. The app doesn't call it, so `exercise-log.json` is no longer recorded; add the uuids (and the contract) if the app ever edits a log's distance or duration.
- **The list cap is checked before the insert** (`POST /api/exercise-lists`), so two creates at once can pass it; the freeze then covers the extra list. Same pattern as habits and custom exercises.

- **`@trackbit/types` has no `uuid` on sessions, logs and sets** (D2 added the column). The web ignores it; its optimistic rows use negative temp ids. Adopting client uuids on the web too would let it drop the temp-id swapping in `useActivityTracker.ts`, and then the types should carry `uuid`.
- **Session rows stay in Room for every day the app opened** (D2), until sign-out. Small, but never pruned; prune days older than the history window if it ever matters.
- **Deleting a session, log or set isn't gated on frozen habits** on the server (creates and edits are). Same as before D2; decide whether deletes of frozen data should be allowed.
- **A preferred-source change made offline is lost** (D4): `PreferencesRepository` updates the cached user and PATCHes once; if the PATCH fails, the next session refresh brings the server's value back. Queue it (outbox or a retrying worker) if that bites.
- **A prescription is found only while a cached queue holds its list item** (D4): a log picked from a list on the web, whose list the app never resolved, starts its sets from the last performance. Pulling every list's queue (or `GET /exercise-lists`) would cover it.
- **A day's sessions refresh only when asked** (`SessionRepository.refresh`: the session screen on open and on pull-to-refresh). A session added on the web shows in the app's session count (via `/today`) before its contents.

- **The tracker's history request can outlive the screen** (D1; the analytics request too, D6, which reaches back to the earliest first log): if the app closes while a past day is shown, the request stays (periodic sync pulls it every 6 h) until the tracker screen starts again and releases it. Releasing from `onCleared` would need an app-wide scope in features.
- **Pull-to-refresh doesn't re-pull history** (D6): `sync()` pulls a history request only when it is 6 h stale, so a past day changed on the web (or deleted) shows its old value on the tracker and analytics until then. Consider forcing the history pull on a user refresh.
- **The web analytics heatmap rates a workout day by its exercise-log count**, the app (tracker, widgets, analytics) by its session count (D6). Pick one on the web.
- **The web's exercise chart preselects the catalog's first exercise**, even one the habit never logged (D6). The app preselects the first exercise with sets. The web also lists exercises logged without sets; the app's list comes from `/sets`, so it doesn't.

- **No rate limit on `POST /api/issues`** (E6): any signed-in user can file reports without limit (text is bounded: description ≤ 5000, stack trace ≤ 20 000). `middleware/rateLimit.ts` is unused and keys by IP through `hono/cloudflare-workers`; a per-user limit would fit better if reports get abused.
- **The app doesn't offer a crash report** (E6): the web's error page pre-fills the stack trace; the app has no uncaught-exception hook. Store the last crash and offer it on the report screen on the next launch, if crashes turn up.

- **Local smoke user** `b10-smoke@example.com` exists in the local dev DB only. Delete it when it's no longer useful.
- **Timezones:** the web tracker takes "today" from the browser's timezone, and the app and widgets use the stored one. The plan's §6 proposal isn't built. Revisit if users travel across timezones and see mismatched days.
