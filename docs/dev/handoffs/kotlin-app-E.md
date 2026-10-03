# Handoff: Kotlin app — Workstream E (settings & configuration)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §4 "Phase 3" (and §0 D3: config needs a connection). Core context: the "Invariants" and "Landmines" of [kotlin-app-D.md](kotlin-app-D.md), [kotlin-app-C.md](kotlin-app-C.md) and [kotlin-app-B.md](kotlin-app-B.md), nothing else.
- **Status:** Phase 3. E1 done on the emulator; **E2 (account) is next**. The Phase 2 exit check is deferred to the final pass with the real-device check (user).
- **Branch:** `kotlin-app` · **Last run:** 2026-10-03 (E1, not committed)

## Where we are

The bottom bar is **Tracker / Stats / Settings**. Settings (`feature/account`) shows the signed-in user, a "Configuration" section with **Habits**, and **Log out** (moved from the tracker's overflow menu, which is gone). Habits opens the habits config (`feature/habits-config`): both groups in order, reordered by dragging a row's grip (also past the Anti-Habits header to change group), tap a row to edit, an "Add Habit" FAB that explains the cap instead of opening at it. The form covers name, tracking method, anti-habit, weekly/daily goals (timed: a minutes dialog), 15 icons, 6 presets + a custom gradient editor, and delete with a confirmation.

On the emulator (API 36, local backend, the user's dev account, an admin): drag Otroer into anti-habits → `PATCH /reorder` stored it; a structured session dropped there snapped back with the web's message; editing (anti off, heart, custom gradient with a moved stop) saved and moved the habit to the end of the habits group; creating "Goal Read" (timed, 5 min) and deleting it worked; the tracker showed each change after the background sync. Test data restored. Not exercised: frozen habits, a role without timed/check, the cap, Spanish, dark mode, offline (shows the offline text + retry).

`./gradlew assembleDebug testDebugUnitTest lintDebug` passes, 0 lint issues, 327 tests (76 of them in core:model's `test` task). Backend 87 tests.

## Phase 3 task split (E1–E6)

| Task | Scope | Status |
|---|---|---|
| **E1** | Settings tab hub, habits config (list, reorder, form, gradient editor, delete, limits) | ✅ 2026-10-03 |
| **E2** | Account: locale (per-app language + PATCH), timezone, units, card style, rest default, preferred source, profile name, change password | next |
| **E3** | Exercise library: browse/search/filter by muscle group, custom exercise CRUD, frozen. First fix the backend bug: user exercise create/update drops `muscleGroups` (follow-ups) | |
| **E4** | Exercise lists: CRUD, item editor + reorder, prescriptions; "add to list" in the picker and library | |
| **E5** | Auth screens: sign-up with invite code, forgot password, verify email. Google sign-in is backlog | |
| **E6** | Issue report (`POST /api/issues`) | |
| **Exit** | Parity with `/tracker`, `/sessions`, `/stats`, `/config/*`, `/account-settings` | |

## Done (E1)

- **Backend** [habits.ts](../../../apps/backend/src/routes/app/habits.ts): name trimmed 3–50 and daily goal ≤ 1440 on create and update; no structured anti-habit on create, update (merged with the stored row) or reorder (400 `anti_habit_not_allowed`), plus the DB check `habits_complex_not_anti` (migration [0013](../../../apps/backend/drizzle/0013_habits_complex_not_anti.sql), applied to local dev only). A PUT that changes group takes the other group's next slot (it used to 409 on the unique order). The body's `id` is ignored (it was written into the row). Reorder lets frozen habits shift within their group and refuses only a group change (before, any frozen habit made the whole list unsortable). Tests in [habits-validation.test.ts](../../../apps/backend/test/habits-validation.test.ts); contracts `habit-updated.json`, `habit-type-not-allowed.json`, `habit-limit-reached.json`, `anti-habit-not-allowed.json`.
- **Web:** the habit form sends `isAntiHabit: false` for a structured session. Hard-coded habit-config strings (page title, drawer titles, preset labels, gradient picker labels) moved to `habits.json` (en/es); `nav.settings` added.
- **core:model:** [HabitRequests.kt](../../../apps/android/core/model/src/main/kotlin/com/trackbit/core/model/HabitRequests.kt) (`HabitRequest`, `HabitReorderRequest`, `HabitRules`), `resolveColorStops` in ColorStops.kt.
- **core:network:** `HabitsService` create/update/delete/reorder; `ApiError.HabitLimitReached`, `HabitTypeNotAllowed`.
- **core:data:** [ConfigResult.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/ConfigResult.kt) (`ConfigResult`/`ConfigError`, the features' view of API errors), [HabitsRepository.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/HabitsRepository.kt).
- **feature/habits-config:** `HabitsConfigViewModel`/`Screen` (reorderable 3.1.0), `HabitFormViewModel`/`Screen`, `GradientEditor`, `HabitTexts`.
- **feature/account:** `SettingsScreen`/`SettingsViewModel` (hub only so far).
- **app:** `SettingsRoute`, `HabitsConfigRoute`, `HabitFormRoute(habitId: Int?)`; third tab.
- **Icons:** grip_vertical, list, log_out, pencil, settings, user (`UI_ICONS` in generate.mjs).

## Next: E2 — account settings

1. Run **Verify**.
2. Add an "Account" entry to [SettingsScreen.kt](../../../apps/android/feature/account/src/main/kotlin/com/trackbit/feature/account/SettingsScreen.kt) opening a new `AccountScreen` in `feature/account`, modelled on the web's [AccountSettings.tsx](../../../apps/frontend/src/features/auth/AccountSettings.tsx) (strings `auth:account.*`, `nav:language_*`, `nav:unit_*`, `nav:card_style_*`).
3. Extend [PreferencesRepository.kt](../../../apps/android/core/auth/src/main/kotlin/com/trackbit/core/auth/PreferencesRepository.kt) (it already does rest seconds and preferred source the same way: cached user first, then one PATCH) with locale, timezone, units, card style. Locale must also switch the app's language with `AppCompatDelegate.setApplicationLocales` (plan §5.4) and refresh localized server data (the exercise catalog names come in the request's `Accept-Language`).
4. Profile name and change password go through Better-Auth (`POST /api/auth/update-user`, `/api/auth/change-password` with `revokeOtherSessions`); add them to `AuthService` with contract recordings. A password change revokes other sessions: check the bearer token survives.
5. Decide (ask the user) whether the timezone is a picker or "use this device's zone" (plan §6 suggests prompting when the device zone changes).

## Invariants — do not break these

(Plus those in the B, C and D handoffs.)

- **Config screens read the server, not Room.** Room's `habits` table holds `/today`'s copy with *resolved* stops and no own custom stops; only `GET /api/habits` has what the form edits.
- **Config writes go through a repository that syncs after success** in `DataScope` (`HabitsRepository.write`), so a closed screen doesn't cancel it and the tracker/widgets catch up. Nothing config-related goes in the outbox (D3; Phase 4).
- **Features see API errors only as `ConfigError`** (core:data keeps core:network internal). Add a case there, mapped in `toConfigResult`, when a new screen needs a new error.
- **`HabitRules` is the form's and the server's rule set**; change `habits.ts` and `HabitRules` together. A check habit keeps whatever daily goal it has (it's ignored).
- **The server picks habit order** on create and on a group change; clients send order only through `PATCH /reorder`, with every habit's (id, order, isAntiHabit).
- **Frozen habits can be opened read-only and deleted** in the app (the web disables editing them entirely, which also blocked deleting); they can shift within a group but not change group.
- **The list reloads on resume** (`LifecycleResumeEffect`), which is how the form's saves show; there's no result passing between the screens.

## Decisions made in E1

| Question | Decision | Why |
|---|---|---|
| Where config lives | Third tab "Settings", a hub (user) | Room for library, lists, account. |
| Order of Phase 3 | Habits, account, library, lists, auth, issues (user) | |
| Google sign-in | Backlog (user) | Needs a Google Cloud Android OAuth client. |
| Phase 2 exit check | Deferred to the final pass (user) | |
| Form rules | The web form's (name 3–50, count goal ≤ 100 by slider, timed ≤ 1440 min), enforced on the server too | Root fix: one rule set at the write boundary. |
| Structured anti-habits | Refused by Zod, by update/reorder, and by a DB check | The web hid the switch but could still send it. |
| Group change in the form | Server moves the habit to the end of the other group | The old order collided (409). |
| Reorder UI | One list with the anti header as a passable row; drag by the grip; `sh.calvin.reorderable` 3.1.0 | Same reach as the web's two drop zones. |
| Timed goal input | The shared minutes/seconds dialog, rounded to whole minutes | Reuses `DurationDialog`. |
| Validation copy | `common:validation.too_short/too_long` | Already in the locale JSON. |

## Landmines

- **Production needs migrations 0008–0013** and the `/days` + `/sets` backend.
- **A swipe that starts at the screen's edge is the system Back gesture** on the emulator: drag gradient handles from inside the screen, or the form closes (and the edit is lost, see follow-ups).
- **The emulator account is an admin** (no limits), so the lock on disallowed types and the cap never show there; use the `b10-smoke@example.com` user (default role: count + complex, 10 habits) to see them.
- **core:model's tests are a JVM `test` task** (results in `build/test-results/test`), not `testDebugUnitTest`; count both when comparing totals.
- **`ErrorContractTest` and `DecodeTest` fail on any unlisted contract file**: add an expectation when you record one.
- The D-handoff landmines still apply (Room schema JSON on version bumps, seeded data, the 6 h history pull).

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug --max-workers=2   # green, 0 lint issues, 327 tests
pnpm android:generate:check                                          # 56 generated files up to date
(cd apps/frontend && npx tsc -b)
pnpm --filter backend test                                           # 87 tests
```

## Open questions

- E2: timezone picker vs. device zone (ask the user). Deferred items: [kotlin-app-followups.md](../tasks/kotlin-app-followups.md) (new in E1: gradient end handles, unsaved form edits, drag-only reorder, habits-config device checks).

## Run log

- 2026-10-03 — E1: Phase 3 split E1–E6 (Settings tab, habits first, Google to backlog, Phase 2 exit deferred). Backend habit rules + migration 0013 + reorder/group fixes; web strings to `habits.json`; `HabitsRepository`/`ConfigResult`; `feature/habits-config` and the Settings hub. Android 327 tests. Next: E2.
