# Handoff: Kotlin app — Workstream E (settings & configuration)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §4 "Phase 3" (and §0 D3: config needs a connection). Core context: the "Invariants" and "Landmines" of [kotlin-app-D.md](kotlin-app-D.md), [kotlin-app-C.md](kotlin-app-C.md) and [kotlin-app-B.md](kotlin-app-B.md), nothing else.
- **Status:** Phase 3. E1–E6 done on the emulator; **the Phase 3 exit check is next**. The Phase 2 exit check is deferred to the final pass with the real-device check (user).
- **Branch:** `kotlin-app` · **Last run:** 2026-10-05 (E6, not committed yet)

## Where we are

Settings has **Report a Bug** above Log out (the web's user-menu item). It opens **Get in touch** (`IssueReportScreen`, `feature/account`): Bug / Feedback, the type's question and placeholder, a description, and a line with what the report says sent it (`Trackbit Android 0.1.0 (1) · Google Pixel 8 · Android 16 (API 36)`), like the web's route line. Send shows the web's thanks and closes after 2 s; offline or a failure keeps the text and says why.

E6 on the emulator (API 36, local backend, the user's dev account): Feedback with "  E6 test from the app  " → row stored trimmed, `type` feedback, `path` null, `client` with the emulator's build and device; the thanks showed and the screen closed. Row deleted. Not exercised: offline, Spanish, dark mode, the admin's new Report column in a browser (tsc only).

Signed out, the sign-in screen links to **Sign up** and **Forgot password?** (`feature/auth`). Sign-up takes name, email, password + confirmation and an optional invite code, sends the app's language and the device's zone, and ends on "check your email" (no session, as on the web). A sign-in refused with `EMAIL_NOT_VERIFIED` offers **Resend verification email**. Forgot password asks for a link (pre-filled with the sign-in email); **the emailed link opens the web's new `/reset-password` page**, where the password is set, and every signed-in device is signed out. Verifying also happens on the web (`/verify-email`), then the user signs in in the app.

E5 on the emulator (API 36, local backend with `RESEND_API_KEY=`): signed out of the dev account; sign-up with an expired seeded invite showed "This invitation code has expired." under the field; with a valid one the user was created (role `tester` from the invite, timezone `America/Costa_Rica`, unverified, invite used up); signing in showed the not-verified text, and Resend → `send-verification-email` 200 and the confirmation; Forgot password (pre-filled) → the reset row was created; resetting by API with that token, then signing in with the new password, opened the tracker. Test user, invites and tokens deleted; the dev account is signed in again. Not exercised: the web reset page in a browser (tsc + backend tests only), Spanish, offline.

The bottom bar is **Tracker / Stats / Settings**. Settings (`feature/account`) shows the signed-in user, a "Configuration" section with **Habits**, and **Log out** (moved from the tracker's overflow menu, which is gone). Habits opens the habits config (`feature/habits-config`): both groups in order, reordered by dragging a row's grip (also past the Anti-Habits header to change group), tap a row to edit, an "Add Habit" FAB that explains the cap instead of opening at it. The form covers name, tracking method, anti-habit, weekly/daily goals (timed: a minutes dialog), 15 icons, 6 presets + a custom gradient editor, and delete with a confirmation.

Under Configuration, **Exercises** opens the exercise library (`feature/exercise-library`): every exercise sorted by name, searched by name, filtered All / Custom / System and by a top-level muscle group (its subdivisions included), each card with its category badge, Mine/System/Frozen badges, description and muscle groups. Tapping one of the user's own opens the form (name, description, muscle chips, category with its inputs, delete with a confirmation that warns when it was logged); system exercises don't open. A frozen one opens read-only and can be deleted. The "Add Custom Exercise" FAB explains the cap instead of opening at it.

Under Configuration, **Lists** opens the user's exercise lists (`feature/exercise-lists`): in order, reordered by dragging the grip (frozen lists stay at the end, locked), "New list" opens a name/description dialog (or explains the cap) and then the new list's editor. The editor shows the list's exercises in order: drag to reorder, X to remove, "Add exercise" (a searchable sheet of the catalog; an exercise can be added twice), and tap a row for its **targets** (sets, reps, weight in the user's unit, distance km, duration, rest, notes, by category), which pre-fill the session's new sets. Rename and delete are in the top bar; a frozen list is read-only but can be deleted. The library cards and the session picker's rows have an **add to list** button (the web's `AddToListMenu`), and the picker's "No lists yet" hint now opens the lists screen.

E4 on the emulator (API 36, the user's dev account): created "E4 Legs" (with a description) and it opened; added Strenght and Cardio; targets 4 × 8, 82.5 kg, rest 1:30, a note → stored as such in the DB; dragged Cardio first → positions swapped, ids kept (this first failed with a 500, see Done); added a third from the library's menu ("Added to E4 Legs"); in a session, E4 Legs was a source with 3 items in the new order, and Strenght's new set started at 8 × 82.5. Session, list and preferred source cleaned up. Not exercised: frozen lists, the caps (admin account), imperial units on the device (unit-tested), Spanish, dark mode, offline.

E3 on the emulator (API 36, the user's dev account, 4 seeded `e3-*` muscle groups incl. a subdivision, all deleted afterwards): created "E3 Dips 2" (cardio, Upper chest, a description), and the DB has the link; saving a duplicate name showed the error under the field; the Chest filter showed it via its Upper chest subdivision; editing another exercise (add Back, switch to strength) saved; both deleted from the form; dark mode checked. Not exercised: frozen exercises, the cap (admin account), Spanish, offline, a delete of a logged exercise (the Room cleanup is covered by `ExerciseLibraryRepositoryTest`).

Tapping the user at the top of Settings opens **Account settings** (`AccountScreen`): name (Save), email (read-only), language, units, card style, rest between sets, time zone (read-only, "follows this device"), and change password. The app's language **follows the signed-in user's `locale`** (as the web syncs i18next from the session), so switching it here or on another device changes the app's per-app language. The user's stored **timezone is kept equal to the device's zone automatically** (`DeviceTimeZoneSync`: at start, at sign-in, on `ACTION_TIMEZONE_CHANGED`, and again if a refresh brings back another zone).

E2 on the emulator: Español switched the app at once (activity recreated in place, `cmd locale get-app-locales` = `[es]`, DB `es`); `cmd alarm set-timezone Europe/Madrid` made the DB follow within seconds; a rename saved with the snackbar; a wrong current password showed the translated error and kept the session. Restoring the DB to `en` by hand and relaunching switched the app back to English, and setting the device zone back made the app PATCH it back. Account data restored. Not exercised: a successful password change (the dev account's password isn't recorded; backend + unit tests cover it), units/card style from this screen, Android 8–12.

E1 on the emulator (API 36, local backend, the user's dev account, an admin): drag Otroer into anti-habits → `PATCH /reorder` stored it; a structured session dropped there snapped back with the web's message; editing (anti off, heart, custom gradient with a moved stop) saved and moved the habit to the end of the habits group; creating "Goal Read" (timed, 5 min) and deleting it worked; the tracker showed each change after the background sync. Test data restored. Not exercised: frozen habits, a role without timed/check, the cap, Spanish, dark mode, offline (shows the offline text + retry).

`./gradlew assembleDebug testDebugUnitTest lintDebug` passes, 0 lint issues, 414 tests (core:model's JVM `test` task included). Backend 138 tests.

## Phase 3 task split (E1–E6)

| Task | Scope | Status |
|---|---|---|
| **E1** | Settings tab hub, habits config (list, reorder, form, gradient editor, delete, limits) | ✅ 2026-10-03 |
| **E2** | Account: locale (per-app language + PATCH), timezone (device's), units, card style, rest default, profile name, change password | ✅ 2026-10-03 |
| **E3** | Exercise library: browse/search/filter by muscle group, custom exercise CRUD, frozen; backend `muscleGroups` fix | ✅ 2026-10-05 |
| **E4** | Exercise lists: CRUD, item editor + reorder, prescriptions; "add to list" in the picker and library | ✅ 2026-10-05 |
| **E5** | Auth screens: sign-up with invite code, forgot password, verify email. Google sign-in is backlog | ✅ 2026-10-05 |
| **E6** | Issue report (`POST /api/issues`); server rules, `client` column, admin shows reports | ✅ 2026-10-05 |
| **Exit** | Parity with `/tracker`, `/sessions`, `/stats`, `/config/*`, `/account-settings` | next |

## Done (E6)

- **Backend** [issues.ts](../../../apps/backend/src/routes/app/issues.ts): the body is strict (a client could set `status`), text is trimmed and bounded (description 1–5000, title ≤ 255, path ≤ 500, client ≤ 255, stack trace ≤ 20 000; it took whitespace-only descriptions and unbounded text), and a blank/null optional field is stored as null. New nullable column **`client`** (what sent the report). Migration [0016](../../../apps/backend/drizzle/0016_issue_rules.sql) (local dev only) cleans legacy rows and adds CHECKs `issues_description_not_blank`, `issues_optional_not_blank`. The admin list returns `client`. Tests in [issues.test.ts](../../../apps/backend/test/issues.test.ts). No contract recorded: the app doesn't decode the response (`IssueService.report` returns `Unit`), and the 400 shape is already covered.
- **Admin** [IssueTable.tsx](../../../apps/admin/src/features/issues/components/IssueTable.tsx): **reports were unreadable**, the table showed title (always null) and path but never the description or stack trace. The "Report" column now shows title, description (4 lines, full on hover), path · client, and a collapsible stack trace.
- **Web** [FeedbackModal.tsx](../../../apps/frontend/src/shared/components/FeedbackModal.tsx): sends the description trimmed, its user agent as `client`, the stack trace capped at the server's limit, and caps the textarea at 5000.
- **core:model:** [IssueRequests.kt](../../../apps/android/core/model/src/main/kotlin/com/trackbit/core/model/IssueRequests.kt) (`IssueType`, `IssueRequest`, `IssueRules` with `client(...)`).
- **core:network / core:data:** `IssueService`; `IssueRepository` (builds `client` from `AppBuild` + `android.os.Build`, returns `ConfigResult`); `AppBuild` provided by `app`'s `AppModule` from `BuildConfig`.
- **feature/account:** `IssueReportViewModel`/`Screen`, Settings entry; the module now depends on core:data. Strings are the web's `issues.*` + `nav.report_bug`; no Android-only strings.
- **Icons:** bug, message_square, smartphone.
- **app:** `IssueReportRoute`.

## Done (E5)

- **Backend** [auth.ts](../../../apps/backend/src/lib/auth.ts): **invited sign-ups were broken since E2** (422): Better-Auth merges the `create.before` hook's data into its input, and `withValidName`'s copy kept `inviteCode` in the insert; the code now leaves the input object first. Invites are consumed by one conditional UPDATE (`consumeInvite`: no shared last use), the code is trimmed (blank = none), and the errors carry stable codes `INVITE_CODE_INVALID` / `_MAX_USES` / `_EXPIRED` (better-call derived them from the translated message). **Password reset was broken for every client**: no client sent `redirectTo`, so the link ended on Better-Auth's error page; `sendResetPassword` now mails `FRONT_URL/reset-password?token=` (`passwordResetUrl`), and `revokeSessionsOnPasswordReset` signs out every device. Tests in [auth-flows.test.ts](../../../apps/backend/test/auth-flows.test.ts); contracts `sign-up-{email-taken,password-too-short,invite-invalid,invite-used-up,invite-expired}.json`.
- **Web:** new [ResetPassword.tsx](../../../apps/frontend/src/features/auth/ResetPassword.tsx) at `/reset-password` (`reset.*` strings, en/es).
- **core:model:** `SignUpRequest`, `PasswordResetRequest`, `VerificationEmailRequest`, `AccountRules.signUpLocale`.
- **core:network / core:auth:** `AuthService.signUp` / `requestPasswordReset` / `sendVerificationEmail`; `AuthRepository.signUp` (locale from `SessionStore.language()`, zone `ZoneId.systemDefault()`), `requestPasswordReset`, `resendVerificationEmail`.
- **feature/auth:** `SignUpViewModel`/`Screen`, `ForgotPasswordViewModel`/`Screen`, resend on `SignInViewModel`, shared `AuthLayout`. Android-only strings `android_auth_sign_up_*`, `android_auth_forgot_sent`.
- **app:** `SignUpRoute`, `ForgotPasswordRoute(email)` in the signed-out graph.

## Done (E4)

- **Backend** [exercise-lists.ts](../../../apps/backend/src/routes/app/exercise-lists.ts): names trimmed 1–120, descriptions and notes trimmed ≤ 500 (blank → null), ids validated (`/abc` is a 400), strict bodies. Prescription bounds: sets 1–50, reps 1–1000, weight 0–1000 kg (exclusive 0), duration 1–86 400 s, distance 0–1000 km, rest 0–3600 s; ≤ 100 items. **Prescribed weights are kg and distances km**, like sets (both clients' pre-fill was already treating them so). New `PATCH /reorder` (`{ ids }`: every list once, one transaction; 400 `exercise_list_order_mismatch`; 403 `exercise_list_frozen` with `listIds` if the frozen set would change) replaces the web's PATCH per list; `PATCH /:id` no longer takes `position` and answers the full list (items + frozen). New `POST /:id/items` (`{ exerciseId }`, appends unprescribed under a row lock; 400 `exercise_list_full`). `PUT /:id/items` locks the list row, refuses repeated item ids, and **writes positions in two phases** (kept rows parked on negative positions): the emulator showed `exercise_list_items_list_position_uq` isn't deferrable on the dev DB (and never in pushed test DBs), so a swap was a 500, on the web too. Migration [0015](../../../apps/backend/drizzle/0015_exercise_list_rules.sql) (local dev only) trims names, nulls blank descriptions/notes and zero targets, converts lbs/miles targets, adds CHECKs. Tests in [exercise-lists.test.ts](../../../apps/backend/test/exercise-lists.test.ts); contracts `exercise-list-{created,updated,items,item-appended}.json`, `exercise-lists-reordered.json`, `exercise-list-{name-taken,not-found,limit-reached,frozen,order-frozen,full}.json`.
- **Web:** reorder through `PATCH /reorder`, add-to-list through `POST /:id/items` (toast on success), list form trims; `@trackbit/types` `Prescription` documents kg/km. No prescription editor (follow-ups).
- **core:model:** [ExerciseListRequests.kt](../../../apps/android/core/model/src/main/kotlin/com/trackbit/core/model/ExerciseListRequests.kt) (`ExerciseListRequest`, `ExerciseListReorderRequest`, `AppendListItemRequest`, `ExerciseListItemsRequest`/`ExerciseListItemInput`, `ListItemDraft`, `ExerciseListItemsResponse`, `ExerciseListRules`); `Prescription.NONE`/`isEmpty`; `ExerciseList.items`/`frozen` are required now.
- **core:network:** `ExerciseListService`; `ApiError.ExerciseListFrozen`, `ExerciseListLimitReached`, `ExerciseListNameTaken`, `ExerciseListFull`.
- **core:data:** [ExerciseListsRepository.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/ExerciseListsRepository.kt) (every write then runs `TrackerSync.syncSources`: sources + every queue Room holds); `SyncDao.cachedQueueKeys`; the matching `ConfigError`s.
- **core:designsystem:** `AddToListButton` + `ListTargets` (stateless; each screen loads the lists from the server); icons `list_plus`, `x`.
- **feature/exercise-lists:** `ExerciseListsViewModel`/`Screen`, `ListEditorViewModel`/`Screen`, `TargetsForm` + `TargetsSheet`, `ListFormDialog`. Android-only strings `android_lists_*` (en/es; `android_lists_full` is a plural).
- **Library and session:** add-to-list on library cards and picker rows (`ExerciseListsRepository.append`, a snackbar names the list); `SessionMessage` is a sealed interface now; `SessionScreen(onOpenLists)`.
- **app:** `ExerciseListsRoute`, `ListEditorRoute(listId)`; Settings → Lists.

## Done (E3)

- **Backend** [exercises.ts](../../../apps/backend/src/routes/app/exercise-info/exercises.ts) is a plain Hono router now (the CRUD factory dropped `muscleGroups`): create/update write the links in a transaction (400 `muscle_group_not_found` rolls back), answer the list's row shape, trim the name 1–100 and the description ≤ 500 (blank → null), 409 `exercise_name_taken`; delete removes the exercise's logs (and sets) and list items, frozen ones too. The list returns `description`. [musclegroups.ts](../../../apps/backend/src/routes/app/exercise-info/musclegroups.ts) is list-only (admins edit under `/admin`). `isUniqueViolation` moved to [db-errors.ts](../../../apps/backend/src/lib/db-errors.ts). Migration [0014](../../../apps/backend/drizzle/0014_exercise_description_not_blank.sql) (local dev only) turns blank descriptions into NULL, drops blank translations and adds the CHECK `exercises_description_not_blank`; the admin route drops blank translations. Tests in [exercise-library.test.ts](../../../apps/backend/test/exercise-library.test.ts); contracts `exercise-created/updated.json`, `muscle-groups.json`, `custom-exercise-frozen-update.json`, `custom-exercise-limit-reached.json`, `exercise-name-taken.json`, `muscle-group-not-found.json`.
- **Web:** the library edits (pre-filled with its muscle groups) and deletes custom exercises; its strings moved to `exercises.json` (en/es); `@trackbit/types` `Exercise.description` (the stale `muscleGroup` is gone).
- **core:model:** `Exercise.description`, `MuscleGroup`, [ExerciseRequests.kt](../../../apps/android/core/model/src/main/kotlin/com/trackbit/core/model/ExerciseRequests.kt) (`ExerciseCategory`, `ExerciseRequest`, `ExerciseRules`).
- **core:network:** `ExerciseService` create/update/delete/muscleGroups; `ApiError.CustomExerciseLimitReached`, `ExerciseNameTaken`.
- **core:database / core:data:** `SyncDao.removeExercise` + `TrackerSync.removeExercise` (a deleted exercise's logs, analytics sets and queue entries leave Room, then catalog + sources re-pull); [ExerciseLibraryRepository.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/ExerciseLibraryRepository.kt); `ConfigError.CustomExerciseFrozen`, `CustomExerciseLimitReached`, `ExerciseNameTaken`.
- **feature/exercise-library:** `ExerciseLibraryViewModel`/`Screen`, `ExerciseFormViewModel`/`Screen`, `ExerciseTexts`. Android-only strings `android_exercises_*`.
- **app:** `ExerciseLibraryRoute`, `ExerciseFormRoute(exerciseId: Int?)`; Settings → Exercises.

## Done (E2)

- **Backend** [auth.ts](../../../apps/backend/src/lib/auth.ts): the user hooks (create + update) now also reject a `locale` outside `SUPPORTED_LOCALES` (`update-user` accepted any string) and store the name trimmed, 1–100 (`INVALID_NAME`); `preferences.ts` uses the shared `SUPPORTED_LOCALES`; web sign-up's name is `trim().min(1).max(100)`. Tests in `session-preferences.test.ts`, and `bearer-auth.test.ts` proves change-password revokes the caller's bearer token and returns a new one in `set-auth-token`. Contracts `update-user.json`, `change-password-invalid.json`, `change-password-too-short.json`, `update-user-invalid-name.json`.
- **core:model:** `UpdateUserRequest/Response`, `ChangePasswordRequest` (`revokeOtherSessions` always encoded), `AccountRules`, `SessionUser.LOCALES`.
- **core:network:** `AuthService.updateUser` / `changePassword` (token from the header, shared with sign-in); `ApiError.Validation.code` (Better-Auth's `code` or the route's `error`); [RequestLanguage.kt](../../../apps/android/core/network/src/main/kotlin/com/trackbit/core/network/RequestLanguage.kt): Accept-Language comes from the session, not `Locale.getDefault()`.
- **core:auth:** `PreferencesRepository` + locale/units/card style/timezone; [AccountRepository.kt](../../../apps/android/core/auth/src/main/kotlin/com/trackbit/core/auth/AccountRepository.kt); `SessionStore.rotate` (adopt the new token; 401s for the old one meanwhile don't sign out) and `language()`; [DeviceTimeZoneSync.kt](../../../apps/android/core/auth/src/main/kotlin/com/trackbit/core/auth/DeviceTimeZoneSync.kt).
- **core:data:** [LocalizedDataSync.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/sync/LocalizedDataSync.kt) re-pulls the exercise catalog (`TrackerSync.syncExercises`) when the same user's locale changes.
- **app:** AppCompat 1.8.0, `MainActivity : AppCompatActivity`, theme parent `Theme.AppCompat.Light.NoActionBar`, `AppLocalesMetadataHolderService` (autoStoreLocales), `android:localeConfig` (generated `core/i18n/res/xml/locales_config.xml`, now 57 generated files); [AppLanguage.kt](../../../apps/android/app/src/main/kotlin/com/trackbit/app/AppLanguage.kt) applied from `MainActivity`; `TrackbitApplication.onConfigurationChanged` re-renders widgets (`WidgetUpdater.refreshAll`) and republishes previews on a language change; `AccountRoute`.
- **feature/account:** `AccountScreen`/`AccountViewModel`; the Settings user row opens it. Android-only strings `android_account_*` (en/es).

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

## Next: Phase 3 exit check

1. Run **Verify**.
2. Walk the web's `/tracker`, `/sessions`, `/stats`, `/config/*` and `/account-settings` against the app, screen by screen; list each gap as fix-now (blocks "a user never needs the web app") or follow-up, and ask the user before fixing the larger ones.
3. Then update the plan's Phase 3 exit line and decide with the user what comes next (Phase 4 is deferred; the final pass holds the Phase 2 exit and the real-device check).

## Invariants — do not break these

(Plus those in the B, C and D handoffs.)

- **Config screens read the server, not Room.** Room's `habits` table holds `/today`'s copy with *resolved* stops and no own custom stops; only `GET /api/habits` has what the form edits.
- **Config writes go through a repository that syncs after success** in `DataScope` (`HabitsRepository.write`), so a closed screen doesn't cancel it and the tracker/widgets catch up. Nothing config-related goes in the outbox (D3; Phase 4).
- **Features see API errors only as `ConfigError`** (core:data keeps core:network internal). Add a case there, mapped in `toConfigResult`, when a new screen needs a new error.
- **`HabitRules` is the form's and the server's rule set**; change `habits.ts` and `HabitRules` together. A check habit keeps whatever daily goal it has (it's ignored).
- **The server picks habit order** on create and on a group change; clients send order only through `PATCH /reorder`, with every habit's (id, order, isAntiHabit).
- **Frozen habits can be opened read-only and deleted** in the app (the web disables editing them entirely, which also blocked deleting); they can shift within a group but not change group.
- **The list reloads on resume** (`LifecycleResumeEffect`), which is how the form's saves show; there's no result passing between the screens.
- **The app's language is the signed-in user's `locale`**, applied by `AppLanguage` from `MainActivity`. Never set the per-app language anywhere else; change the user's locale (`PreferencesRepository.setLocale`). Signed out, the last one stays.
- **Requests speak the session's language** (`RequestLanguage` → `SessionStore.language()`), so a pull right after a switch is already in the new one. Don't go back to `Locale.getDefault()` in the interceptor.
- **The stored timezone is the device's** (`DeviceTimeZoneSync`, user). There is no picker; don't add a second writer.
- **A password change rotates the token through `SessionStore.rotate`**: Better-Auth deletes every session, the caller's too. Any other endpoint that ends the current session must do the same.
- **`ExerciseRules` is the custom exercise form's and the server's rule set** (`exercises.ts` schema); change them together. A description is never blank: NULL in the DB (CHECK), null on the wire, blank translations dropped by the admin route.
- **Deleting an exercise goes through `TrackerSync.removeExercise`**: the server deletes its logs and list items, so Room must drop its copies too or cached sessions, analytics and queues keep showing it.
- **The library reads the server** (descriptions and `frozen` aren't in Room's catalog); Room's catalog stays the picker's/sessions' source and catches up after each library write.
- **`ExerciseListRules` is the list editor's and the server's rule set** (`exercise-lists.ts` schemas); change them together.
- **Prescriptions are kg and km** (seconds for durations), like sets: only the UI converts (`TargetsForm` with `kgToDisplay`/`displayToKg`). An unchanged weight is kept exactly, so pounds' half-rounding doesn't drift it.
- **List writes go through `ExerciseListsRepository`**, which re-pulls the sources and every cached queue after success (`TrackerSync.syncSources`): the picker and new sets' prescriptions read them from Room.
- **The editor's item writes run one at a time, each applied to the server's latest items** (`ListEditorViewModel.saveItems`, keyed by item id): a replace-all built from a stale copy would delete an item appended meanwhile. Appends always go through `POST /:id/items`, so every item the editor holds has an id.
- **Frozen lists stay at the end of the order** (the freeze walks positions); the client refuses such a drag before the server does.
- **`PUT /:id/items` never relies on the position constraint being deferred**: kept rows are parked on negative positions first.
- **The reset link is the server's** (`passwordResetUrl` → the web's `/reset-password?token=`); clients never send `redirectTo`. A reset revokes every session, so the app just meets a 401 on its next call.
- **A field that isn't a user column must be deleted from the hook's input object itself** (`create.before` in `auth.ts`): Better-Auth merges the returned data into it.
- **Invite errors are branched on `code`**, never on the (translated) message. Sign-up starts no session: routing doesn't change on success.
- **`IssueRules` is the report form's and the server's rule set** (`issues.ts` schema); change them together. Clients say what sent a report in `client` (the web its user agent, the app `IssueRules.client`), never inside the description.
- **Server-side user rules live in `auth.ts`'s user hooks** (timezone, locale, name), which cover sign-up, `update-user` and OAuth; `AccountRules` mirrors them.

## Decisions made in E6

| Question | Decision | Why |
|---|---|---|
| App context | New `client` column (build + device); `path` stays the web's route, null from the app | The app has no route worth sending; stuffing device info into `path` or the description would mix fields. |
| Where the screen lives | `feature/account`, Settings → Report a Bug above Log out | The web's user-menu item; no new module for one screen. |
| Dialog or screen | Full screen, closing 2 s after the thanks | A multi-line field fits a screen better on a phone; same copy and flow as the web. |
| Admin couldn't read reports | Fixed in E6 (Report column) | A report nobody can read makes the feature pointless. |
| Rate limit, crash reports | Follow-ups | Not needed for parity. |

## Decisions made in E5

| Question | Decision | Why |
|---|---|---|
| Where the reset is finished | The web's new `/reset-password` page; the app only requests the link | One page for every client; App Links need the release certificate on the web host (follow-ups). |
| Who builds the reset link | The server, from the token (`FRONT_URL`) | Root fix: no client sent `redirectTo`, so every link failed. |
| Sessions after a reset | All revoked (`revokeSessionsOnPasswordReset`) | A reset is how an account is taken back. |
| Invite code in the app | Always shown, optional | Invites arrive by email; the web shows it only from the link. |
| Unverified sign-in | Resend button under the message | `sendOnSignIn` would mail on every attempt. |
| Sign-up language | The app's current language (`SessionStore.language()`), else English | As the web's `detectLocale`. |

## Decisions made in E4

| Question | Decision | Why |
|---|---|---|
| Prescription editing | In E4, Android ahead of the web (user) | The plan's E4 scope; the web keeps the targets through its round-trip. |
| Prescription units | kg and km, stored like sets; migration converts old lbs/miles targets | Root fix of the D4 follow-up: both clients already pre-filled sets from them as kg. |
| Which targets show | By category, as the set controls record (strength: sets/reps/weight; cardio: laps/distance/duration; flexibility: sets/duration) + rest and notes | Hidden ones are kept, not cleared. |
| List reorder | One `PATCH /reorder` in a transaction | The web's PATCH per list could stop halfway. |
| Add to list | `POST /:id/items` appends on the server | A replace-all from a cached copy could drop concurrent changes; the app's sources don't carry list ids. |
| Add-to-list data | The menu loads `GET /exercise-lists` (library on refresh, session when the menu opens) | Config needs a connection anyway; no key parsing. |
| Same exercise twice | Allowed from the editor, refused (checked) from the add-to-list menus | As the web: routines repeat exercises; the quick menu avoids accidental duplicates. |

## Decisions made in E3

| Question | Decision | Why |
|---|---|---|
| Library reads | Server (`GET /exercises` + `/muscle-groups`), not Room | Room's catalog has no descriptions; same as the E1 invariant. |
| Muscle filter | Chips of top-level groups; a group matches its subdivisions | The taxonomy is hierarchical; a flat list of every level would be long and miss sub-linked exercises. The web has none yet (follow-ups). |
| System exercises | Not tappable | Read-only for users; the card already shows everything. |
| Delete side effects | Drop the exercise's logs/sets/queue entries in Room, then re-pull catalog + sources | The server deletes them; waiting for the next pull would show ghosts. |
| Blank descriptions | Migration 0014 + CHECK + admin schema, not a client-side hide | Root fix: legacy rows held `''`. |
| Name taken | Shown under the name field, cleared when the name changes | As the web does. |

## Decisions made in E2

| Question | Decision | Why |
|---|---|---|
| Timezone: picker or device zone | Device zone, kept in sync automatically, shown read-only (user) | The phone travels with the user; `DayClock` already follows the device's day. |
| Who owns the app language | The user's `locale` (cached session) | Same as the web; one source of truth, and a change on another device follows. |
| Per-app language API | AppCompat (`setApplicationLocales`, autoStoreLocales) | Works from API 26; the system handles it from 33. |
| Accept-Language | From the session's locale (`RequestLanguage`) | `Locale.getDefault()` changes only once AppCompat applies, which raced the catalog re-pull; on 8–12 a background process never gets it. |
| Password change token | Adopt `set-auth-token` from the response via `SessionStore.rotate` | Better-Auth revokes the caller's session too (checked in its source and a backend test). |
| Profile image, delete account, preferred source | Not on the screen | No image loader; the web's delete is a placeholder; the picker owns the source. In the follow-ups. |
| Name rule | Trimmed 1–100, in `auth.ts` hooks + web sign-up + `AccountRules` | Root fix: `update-user` accepted blank names. |

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

- **Deploy E5's backend and web together**: reset emails now link to the web's `/reset-password`, which only exists in the new frontend.
- **E6's backend needs migration 0016 first** (it writes `client`). The web and admin work against either backend: the old route drops `client`, and a missing one shows as nothing.
- **Production needs migrations 0008–0016** and the `/days` + `/sets` backend (0014–0016 are applied to local dev only). Run 0015's audit query (names that collide once trimmed) first.
- **The local dev server ran with the real `RESEND_API_KEY`** until E5 restarted it from this session with it blank (logging to the session scratchpad). Restart it from your own terminal (`pnpm dev:backend`, or `RESEND_API_KEY= pnpm dev:backend` to keep mail off). Skipped mails only log a warning: read reset tokens from `verification` (`identifier = 'reset-password:<token>'`).
- **`input keycombination 113 29` didn't select a password field's text** (E5): clear it with `KEYCODE_MOVE_END` and repeated `KEYCODE_DEL`.
- **The local backend's `tsx watch` once missed an edit for two days** (follow-ups): if a backend change seems absent, compare the dev server's start time with the file's mtime and restart it. In E3 it was restarted from this session (`npx tsx watch --env-file=.env src/dev.ts` in `apps/backend`, logging to the session scratchpad); restart it from your own terminal with `pnpm dev:backend`.
- **Extended FABs don't show in `uiautomator dump`** (E4): tap them by coordinates (bottom right, ≈ (876, 2220) at 1080×2400).
- **Drag-to-reorder on the emulator needs `adb shell input draganddrop x1 y1 x2 y2 2500`** on the grip; `input swipe` doesn't start the drag.
- **Picking a list in the session sets the account's preferred source**: reset it (`preferred_exercise_source` NULL for the dev account) after testing with a throwaway list.
- **The dev DB has no muscle groups again** (E3 seeded `e3-*` ones and deleted them). Seed some to test the library filter or the form's chips.
- **Gboard's floating toolbar can cover the left of the screen** after `KEYCODE_ESCAPE` hides the keyboard, and once asked for the microphone; tap `Don't allow` and avoid chips on the far left, or hide it with `KEYCODE_BACK` while a field has focus.
- **The emulator's soft keyboard covers the lower half of the screen**: `input tap` on a field under it types a key instead. Move between fields with `input keyevent KEYCODE_TAB`, and clear a field with `input keycombination 113 29` + `KEYCODE_DEL`. When grepping `uiautomator dump` for a label with accents, match an ASCII prefix (`text="Nueva contrase`).
- **Changing the emulator's zone:** `adb shell cmd alarm set-timezone <IANA id>`; the app PATCHes the account to follow it, so set it back to `America/Costa_Rica` afterwards. Per-app language: `adb shell cmd locale get-app-locales com.trackbit.app`.
- **Room's DB on the emulator has no `sqlite3`**: copy `databases/trackbit.db{,-wal,-shm}` out with `adb exec-out run-as com.trackbit.app cat …` and open it locally.
- **A swipe that starts at the screen's edge is the system Back gesture** on the emulator: drag gradient handles from inside the screen, or the form closes (and the edit is lost, see follow-ups).
- **The emulator account is an admin** (no limits), so the lock on disallowed types and the cap never show there; use the `b10-smoke@example.com` user (default role: count + complex, 10 habits) to see them.
- **core:model's tests are a JVM `test` task** (results in `build/test-results/test`), not `testDebugUnitTest`; count both when comparing totals.
- **`ErrorContractTest` and `DecodeTest` fail on any unlisted contract file**: add an expectation when you record one.
- The D-handoff landmines still apply (Room schema JSON on version bumps, seeded data, the 6 h history pull).

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug --max-workers=2   # green, 0 lint issues, 414 tests (with core:model's `test`)
pnpm android:generate:check                                          # 62 generated files up to date
(cd apps/frontend && npx tsc -b) && (cd apps/admin && npx tsc -b)
pnpm --filter backend test                                           # 138 tests
```

## Open questions

- None blocking. Deferred items: [kotlin-app-followups.md](../tasks/kotlin-app-followups.md) (new in E4: no web prescription editor, the dev DB's non-deferrable position constraint, the racy list cap; new in E2: password-change device check, widgets on 8–12 keep the system language, profile image / delete account / preferred source not on the screen).

## Run log

- 2026-10-03 — E1: Phase 3 split E1–E6 (Settings tab, habits first, Google to backlog, Phase 2 exit deferred). Backend habit rules + migration 0013 + reorder/group fixes; web strings to `habits.json`; `HabitsRepository`/`ConfigResult`; `feature/habits-config` and the Settings hub. Android 327 tests. Next: E2.
- 2026-10-03 — E2: account settings (name, language, units, card style, rest, password; timezone = device's, user). Backend: locale + name rules in `auth.ts` hooks; change-password token rotation proven. Android: AppCompat per-app language following the user's locale, `RequestLanguage`, `SessionStore.rotate`, `DeviceTimeZoneSync`, `LocalizedDataSync`. 341 tests, backend 90. Next: E3.
- 2026-10-05 — E3: exercise library. Backend: exercises router rewritten (muscle groups stored, rules, name-taken, delete with logs), muscle groups list-only, migration 0014 (no blank descriptions) local dev only; web library edit/delete. Android: `ExerciseLibraryRepository`, `TrackerSync.removeExercise`, `feature/exercise-library`, Settings → Exercises. 360 tests, backend 104. Next: E4.
- 2026-10-05 — E4: exercise lists with per-item targets (Android ahead of the web, user). Backend: list rules + migration 0015 (prescriptions in kg/km), `PATCH /reorder`, `POST /:id/items`, two-phase item positions (the emulator caught a 500 on a swap). Web: reorder/append through them. Android: `ExerciseListsRepository` + `TrackerSync.syncSources`, `feature/exercise-lists`, add-to-list in library and picker. 390 tests, backend 124. Next: E5.
- 2026-10-05 — E5: auth screens (sign-up with optional invite, forgot password, resend verification). Backend: invited sign-ups fixed (broken since E2), atomic invite use with stable codes, reset link built by the server + sessions revoked on reset; web `/reset-password` page. Android: `AuthRepository` sign-up/reset/resend, `feature/auth` screens. 405 tests, backend 134. Next: E6.
- 2026-10-05 — E6: issue report. Backend: strict, trimmed, bounded `POST /api/issues`, new `client` column, migration 0016 (local dev only); admin table shows the report text, context and stack trace (it showed none); web sends its user agent. Android: `IssueRepository` + `AppBuild`, Settings → Report a Bug. 414 tests, backend 138. Next: Phase 3 exit check.
