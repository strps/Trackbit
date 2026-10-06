# Handoff: Kotlin app — Workstream F (full offline capability)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §4 "Phase 4" (decisions F-D1–F-D4 and the F1–F8 split) and §2.2. Core context: the "Invariants" and "Landmines" of [kotlin-app-E.md](kotlin-app-E.md), [kotlin-app-D.md](kotlin-app-D.md), [kotlin-app-C.md](kotlin-app-C.md) and [kotlin-app-B.md](kotlin-app-B.md), nothing else.
- **Status:** Phase 4, F1 committed (651bc43); F2 committed (422c3c1); F3 done 2026-10-06 (uncommitted); **F4 (config outbox, habits through it) is next**. Phase 2 and Phase 3 exit checks are deferred to the final pass with the real-device check (user).
- **Branch:** `kotlin-app` · **Last run:** 2026-10-06 (F3)

## Where we are

**F3:** every config screen reads Room, so each one opens offline once a sync has pulled its data. Room v10 holds the whole config: habits as the form edits them, the library with descriptions, lists with items, muscle groups, limits, and a `config_pulls` marker per part. Writes still go online, and each one stores the server's answer in Room before returning. F4–F6 move them to the outbox. Android has 439 tests and 0 lint issues; the backend is unchanged.

**Before F3 (F2):** 
No int id of a habit, exercise, list or list item exists on Android any more (F-D1): the DTOs carry only their `uuid` (and `habitUuid`, `exerciseUuid`, `listItemUuid`, `listUuid` for references), so the compiler refuses an int where a row is named. Room v9, the outbox, widgets' Glance state, notification and nav routes all name rows by uuid, and every request uses the uuid form F1 added. Behaviour is unchanged, apart from the two points under "Decisions made in F2".

Room v9 is a **clean reset** (user's choice): a database from versions 1–8 opens empty (outbox and running timers included) and refills from the next sync; the auth session lives outside Room, so the user stays signed in. A widget placed before v9 shows "choose a habit" and works again once one is picked.

Android 411 tests (414 − 7 removed 1→8 migration tests + 4 new), 0 lint issues; backend 162; contracts: `day-log-ensured.json` and `habit-not-found-update.json` added, `exercise-log.json` dropped (web-only route, see Decisions). Verified on the emulator (below).

## Phase 4 task split (F1–F8)

| Task | Scope | Status |
|---|---|---|
| **F1** | Backend uuids: migration 0017, idempotent creates, uuid refs on every route the app calls, uuids in its responses, `list:<uuid>` keys; contracts | ✅ 2026-10-06 |
| **F2** | Android identity: DTOs, Room v9, outbox, widgets, repositories, features and nav by uuid. No behaviour change | ✅ 2026-10-06 (422c3c1) |
| **F3** | Room holds the whole config; config screens read Room | ✅ 2026-10-06 |
| **F4** | Config outbox (field-level ops, per-row dependencies, failed state) + habits through it | next |
| **F5** | Exercise library through the outbox | |
| **F6** | Lists through the outbox; offline-created lists as sources | |
| **F7** | Preferences through the outbox | |
| **F8** | Failed-create UX, offline exit check | |

## Done (F3)

- **Room v10**, an auto-migration from 9 (`MigrationTest` checks that a v9 habit, its log and the outbox survive):
  - `habits` gains `ownColorStops` (default `[]`), and `summaryDay` becomes nullable.
  - `exercises` gains `description`.
  - New tables: `exercise_lists`, `exercise_list_items` (FK to the list, cascade; `exerciseUuid` is not an FK), `muscle_groups`, `limits` (one row with an embedded `EffectiveLimits?`; `allowedHabitTypes` is stored comma-separated) and `config_pulls` (`ConfigPart` → `pulledAt`).
  - Entities: [ConfigEntities.kt](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/entity/ConfigEntities.kt). Reads: [ConfigDao](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/dao/ConfigDao.kt). Writes: `SyncDao` (`applyHabits/Lists/MuscleGroups/Limits`, `storeHabit/HabitOrder/Exercise/List/ListItems`, `removeHabit/List`). `removeExercise` also drops the exercise's list items.
- **One `habits` table, two pulls:**
  - `/today` writes everything except `ownColorStops`. It keeps Room's value, or copies its stops in for a Custom habit.
  - `/habits` writes the config and resolves `colorStops` (`resolveColorStops`). It keeps the tracker summary.
  - A habit only `/habits` has brought in is **unsummarized** (`summaryDay` null). Its streak is null and `HabitDay`/`TrackedHabit.logsKnownFrom` is null, so `allLogsKnown` is false: its `firstLogDay` is unknown, not "never".
- **DTOs:** `Habit` lost `userId`/`createdAt`, and `ExerciseList` lost `userId`/`authorId`/`createdAt`/`updatedAt`. Nothing read them, and Room would have had to store them.
- **`TrackerSync`:**
  - `syncConfig(vararg ConfigPart)` pulls parts. One that fails doesn't stop the others; the result is the worst.
  - `sync()` also pulls every part that is due: never pulled, or older than `CONFIG_MAX_AGE` (1 h). That covers sign-in (the first periodic run) and the periodic sync.
  - `write(call, store)` stores a write's answer under the lock, fenced on the session the write started with. `delete(call, store)` counts a 404 as done, as the outbox does.
  - `syncExercises`/`removeExercise` are gone. `LocalizedDataSync` now pulls exercises and muscle groups.
- **Repositories:**
  - Reads are Flows that are null until their part is pulled: `habits()`, `limits()`, `exercises()`, `muscleGroups()`, `lists()`. `refresh(): SyncResult` pulls habits+limits, catalog+muscle groups+limits, or lists+limits.
  - Writes return `ConfigResult` as before, after their answer is in Room. A delete that finds the row gone is a success.
  - In the background: a habit write runs `sync()`, an exercise delete pulls the catalog and then `syncSources()`, and a list write runs `syncSources()`.
- **VMs:**
  - The list screens (habits config, library, lists) observe Room and refresh on resume. A failed refresh shows offline/failed as a message; `loadFailed` only when Room has nothing. A reorder in flight keeps its own order (`reordering`), as a drag does.
  - The forms take a one-time snapshot from Room and pull only when Room lacks the part.
  - The list editor observes Room. Each item write applies its change to Room's items, read under the write lock. The items on screen stay optimistic until the last pending write settles. A list that disappears from Room shows NotFound.
  - The session and library add-to-list menus read Room and pull on open.
- **Tests:** `ConfigSyncTest`, `HabitsRepositoryTest`, Room-backed list and library repository tests, and VM tests for offline-from-Room and follow-Room. `trackerSync(...)` in core:data `Fakes.kt` builds a `TrackerSync` whose `/habits` answers the same habits its `/today` does. The feature fakes model a server plus a Room copy, which `refresh` fills and successful writes update.
- **Emulator** (API 36, local backend, the user's account): the v9 → v10 install kept the tracker as it was. Online, Habits, Library, Lists and the list editor loaded. Then, in airplane mode with the app killed and relaunched: the habits list, a habit's form, the library, an exercise's form, the add-to-list menu ("Already in this list"), the lists and the list editor all loaded from Room. Each refresh showed "Can't reach Trackbit". Connectivity was restored afterwards. Nothing was written. Not exercised: writes, other locales, a fresh sign-in.

## Done (F2)

- **core:model:** `Habit`, `TodayHabit`, `Exercise`, `ExerciseList`, `ExerciseListItem` lost `id` (and the item its `listId`) for `uuid`; references became `habitUuid` (`DayLog`, `HabitDayValue`, `HabitSetsResponse`), `exerciseUuid`/`listItemUuid` (`HabitSet`, session logs, `QueueEntry`, `QueueLog`), `listUuid` (`ExerciseListItemsResponse`). Requests: `habitUuid` in check/increment/ensure/create-session, `exerciseUuid`/`listItemUuid` in the log create, `HabitOrder(uuid, …)`, list reorder `{ uuids }`, append `{ uuid, exerciseUuid }`, item input `{ uuid, exerciseUuid, … }`, `ListItemDraft(uuid, exerciseUuid, …)`. Creates (`HabitRequest`, `ExerciseRequest`, `ExerciseListRequest`) take an optional `uuid`, left out of the body when null (updates).
- **core:network:** `/uuid/{uuid}` paths for habits, exercises and lists; `habitUuid` queries for `/sets` and `/exercise-sessions`. `ApiError.HabitFrozen` / `CustomExerciseFrozen` are data objects now: their bodies carry only int ids, which the app must not hold.
- **core:database v9:** every key and reference column renamed and retyped (`habits.uuid` primary key, `habitUuid` foreign keys in `day_logs`, `exercise_sessions`, `habit_sets`, `habit_set_pulls`, `timers`, `outbox`; `exercises.uuid`; `exerciseUuid`/`listItemUuid` in `exercise_logs`, `habit_sets`, `queue_entries`). [Migrations.kt](../../../apps/android/core/database/src/main/kotlin/com/trackbit/core/database/Migrations.kt) is now `withMigrations()` = `fallbackToDestructiveMigrationFrom(dropAllTables = true, 1..8)`; the auto-migrations and `FROM_3_TO_4` went (dead with the reset), and `MigrationTest` checks that a v8 database with a pending op opens empty at 9. Sort tie-breaks are `uuid` instead of `id`.
- **core:data:** `newUuid()` ([Uuids.kt](../../../apps/android/core/data/src/main/kotlin/com/trackbit/core/data/Uuids.kt)) shared by sessions, list appends and the forms. Config repositories take uuids; `create` requires `request.uuid` (the form picks it); `update` strips it. `TrackedHabit.uuid`.
- **Features:** forms keep a new row's uuid in `SavedStateHandle` (`newHabitUuid`, `newExerciseUuid`), so a retried save, even after process death, can't create twice (tested in `ExerciseFormViewModelTest`); the lists screen picks it when the create dialog opens (`ListForm.newUuid`). Nav routes: `HabitFormRoute(habitUuid)`, `ExerciseFormRoute(exerciseUuid)`, `ListEditorRoute(listUuid)`, `SessionRoute(habitUuid, day)`.
- **App:** a habit timer's notification is tagged `habit-timer:<uuid>` with a fixed id (`HABIT_ID`); its Stop/+30s intents carry `habit:<uuid>` as their data, which makes them distinct (request codes were habit ids).
- **Widget:** Glance state key `habitUuid` (string); action parameter `habitUuid`; the Today list's `itemId` folds the uuid's 128 bits into a Long (`UUID.fromString`, so fixtures and previews use real UUIDs: `UUID(0, n)`).
- **Backend test only:** [contracts.test.ts](../../../apps/backend/test/contracts.test.ts) records `day-log-ensured.json` (tracker test) and `habit-not-found-update.json` (habits test, last), and no longer records the web-only `PATCH /exercise-logs/:id`. No backend code changed.
- **Emulator** (API 36, local backend, the user's account, outbox empty before installing): the v8 database reset and refilled with the account still signed in; +1 from the tracker → `POST /check/increment` by uuid; a session on Ejercicio with source "rstytersry" → the preference stored `list:<uuid>`, Play logged the list's first item with its `list_item_id`, the cursor moved on, and the new set took the item's prescription (rest 1:00:00 from `rest_seconds = 3600`); a rename through the habit form → `PUT /habits/uuid/…`; a drag in the list editor → items kept their uuids in the new order (dragged back); the Today widget rendered and its + logged Check; the heatmap widget's picker stored the habit and the grid showed its history. Test rows deleted, the habit name and the preferred source restored. Not exercised: timers' notification buttons, exercise create/delete, a list create, offline, Spanish.

## Done (F1)

- **Migration** [0017_config_uuids.sql](../../../apps/backend/drizzle/0017_config_uuids.sql) (applied to local dev, 10 habits got distinct uuids): `uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE` on `habits`, `exercises`, `exercise_lists` and `exercise_list_items`, and the preferred-source rewrite. A test runs that statement as written ([config-uuids.test.ts](../../../apps/backend/test/config-uuids.test.ts) "migration 0017").
- **Shared helpers** [uuid-refs.ts](../../../apps/backend/src/lib/uuid-refs.ts): `oneOf` / `atMostOne` (moved from tracker.ts), `uuidParamSchema`, `uuidConflictException`, `createdBefore` (a retried create's row, or 409), uuid→id lookups scoped to what the user may see (`habitIdByUuid`, `visibleExerciseIdByUuid`, `ownExerciseIdByUuid`, `listIdByUuid`, `listItemIdByUuid`), and `exerciseUuids` / `listItemUuids` / `withLogUuids` for responses.
- **Routes**, as the app will call them (contracts record these forms):

| Route | Request by uuid | Response adds |
|---|---|---|
| `POST /api/habits` | `uuid` (idempotent, checked before limits) | `uuid` (column) |
| `PUT /api/habits/uuid/:uuid`, `DELETE …/uuid/:uuid` | path | `uuid`; delete `{ success, deletedId, uuid }` |
| `PATCH /api/habits/reorder` | items `{ uuid \| id, order, isAntiHabit }`; an unknown uuid is skipped like an unknown id | |
| `POST /api/tracker/check`, `/check/increment`, `/day-logs/ensure` | `habitUuid` (exactly one of `habitId`/`habitUuid`) | `habitUuid` |
| `GET /api/tracker/today` | | habit `uuid` |
| `GET /api/tracker/days` | | `habitUuid` per day |
| `GET /api/tracker/sets?habitUuid=` | query | `habitUuid`, `exerciseUuid` per set |
| `POST /api/tracker/exercise-sessions` | `{ uuid, habitUuid, day }` | |
| `GET /api/tracker/exercise-sessions?habitUuid=&day=` | query | `exerciseUuid`, `listItemUuid` per log |
| `POST /api/tracker/exercise-logs` | `exerciseUuid` (one of), `listItemUuid` (at most one of) | `exerciseUuid`, `listItemUuid` |
| `POST /api/exercise-info/exercises` | `uuid` (idempotent) | `uuid` (list too) |
| `PATCH`/`DELETE /api/exercise-info/exercises/uuid/:uuid` | path (own exercises only) | delete `{ success, id, uuid }` |
| `POST /api/exercise-lists` | `uuid` (idempotent) | `uuid`; items `uuid`, `exerciseUuid` everywhere |
| `GET`/`PATCH`/`DELETE /api/exercise-lists/uuid/:uuid` | path | delete `{ success, deletedId, uuid }` |
| `PUT /api/exercise-lists/uuid/:uuid/items` | items `{ uuid \| id, exerciseUuid \| exerciseId, … }`: a uuid this list holds keeps that row, any other uuid is a new item with it (409 if another list holds it) | `{ listId, listUuid, items }` |
| `POST /api/exercise-lists/uuid/:uuid/items` | `{ uuid?, exerciseUuid \| exerciseId }`; a retry with the same item uuid appends nothing | same |
| `PATCH /api/exercise-lists/reorder` | `{ uuids }` (or `ids`) | |
| `GET /api/exercise-sources`, `/:key` | key `list:<uuid>` | `ref.listUuid`; entries `exerciseUuid`, `listItemUuid` |

- **`@trackbit/types`:** `uuid` on `Habit`, `Exercise`, `ExerciseList`, `ExerciseListItem` (+ `exerciseUuid`); `ExerciseSourceRef` list is `{ kind: 'list', listUuid }`; `QueueEntry.exerciseUuid` / `listItemUuid`; key pattern and (de)serializers.
- **Web:** [use-exercise-lists.ts](../../../apps/frontend/src/features/exercise-lists/use-exercise-lists.ts) `ListItemInput` is named by `uuid` (new items get `crypto.randomUUID()` in `newItemInput`, so the optimistic row has its final identity); [AddToListMenu.tsx](../../../apps/frontend/src/features/exercise-lists/AddToListMenu.tsx) matches `ref.listUuid`.
- **Contracts** ([contracts.test.ts](../../../apps/backend/test/contracts.test.ts)): every request uses the app's uuid form; client uuids are fixed per test (`uuidsFrom(base)`, ranges of 100 so one test's additions don't renumber another's); server-chosen uuids are normalized to `ffffffff-…-N` by first appearance in the file, inside strings too. The session ids stay `…001`–`…004`.

## Next: F4: config outbox, habits through it

Read plan §4 F4. Room and the screens are ready: the screens follow Room, and a write's answer lands through `SyncDao.store*`.

1. **Config ops in the outbox.** Field-level updates (F-D2: only the changed fields). Per-row dependencies, so a refused create parks only what builds on it. A failed state with its reason (F-D3).
2. **Habit create/update/delete/reorder through it.** Each one writes Room optimistically, then queues the op. The flush stores the answer with the same `store*` calls `TrackerSync.write` uses. A create is checked against the cached `limits` and Room's habit count.
3. **Offline habit creates.** They insert an unsummarized row today. Decide whether a habit created on the device should start summarized: no logs, streak 0, `summaryDay` = today.
4. Tracker ops on a habit created offline must wait for its create (see Landmines).

## Invariants — do not break these

(Plus those in the B, C, D and E handoffs.)

- **No int id of a habit, exercise, list or list item on Android** (F-D1). DTOs don't declare `id` for them; a new DTO that references one declares the uuid field only. Muscle groups, sessions' `dayLogId`/`exerciseSessionId` and `LastPerformance.id` are not such rows.
- **A create's uuid is picked once per user intent** (form: `SavedStateHandle`; dialog: `ListForm.newUuid`; append, session, log, set: at the write) and reused by every retry of it.
- **Room changes need a migration from v9 on**; the destructive fallback covers only 1–8.
- **Rows a client may create offline carry a client-chosen `uuid`** (habits, exercises, lists, list items; sessions, logs, sets since D2). A create given one is idempotent and answers 201 with the first row, checked **before** limits; another user's uuid is 409 `uuid_conflict`. New such tables follow [uuid-refs.ts](../../../apps/backend/src/lib/uuid-refs.ts).
- **Every route the app calls takes the uuid form**, exactly one of id/uuid (`oneOf`), resolved among the rows the user may see; an unknown or foreign uuid answers like an unknown id (404, or the route's own "not found"/"not available" error). Keep the int forms for the web.
- **Responses carry the uuid beside each int reference the app reads** (`habitUuid`, `exerciseUuid`, `listItemUuid`, `listUuid`). Adding a reference the app reads means adding its uuid too.
- **Config updates apply only the fields given** (F-D2: last write wins per field). Never turn an update into a replace.
- **List source keys are `list:<uuid>`**; the pattern in `@trackbit/types` is the only definition. The app still never parses a key (D invariant); F6 may build `list:<uuid>` for a list created offline, and that is the only place allowed to.
- **Config screens read Room only.** A config part is "known" once `config_pulls` has it; rows `/today` brings don't count for habits. A write's answer reaches Room before the write returns.
- **The two habit pulls own different columns.** `/today` must not overwrite `ownColorStops`, and `/habits` must not touch the summary (`summaryDay`, `streakBeforeDay`, `firstLogDay`). A null `summaryDay` means unsummarized: no streak, and no log is known.
- **Contract client uuids come from the test's own range** (`uuidsFrom(base)`); never a global counter, never random.

## Decisions made in F3

| Question | Decision | Why |
|---|---|---|
| One habits table or two | One table; each pull writes only the columns it owns | The tracker, widgets and config read the same rows, and a write's answer updates them all |
| A habit only `/habits` knows | Unsummarized: `summaryDay` null, streak and `logsKnownFrom` null | Its logs and first log day are unknown. A sentinel date would hide that |
| "Not pulled yet" vs "empty" | A `config_pulls` row per part | A user can have zero habits or lists, so an empty table doesn't mean anything wasn't pulled |
| A write's answer | Stored in Room before the write returns (under the sync lock) | Otherwise Room-backed screens show the old rows until the background pull (a created list's editor would say NotFound) |
| A delete answering 404 | Success, and the row leaves Room | Same rule as the outbox: what the user wanted. The editor's NotFound branch for deletes went |
| When `sync()` pulls config | When a part is never pulled or older than 1 h; screens pull their parts on resume | Keeps the offline copy fresh without five extra pulls every 15 minutes |
| Unused DTO fields | Dropped (`Habit.userId/createdAt`, `ExerciseList.userId/authorId/createdAt/updatedAt`) | Nothing read them; storing them would be dead columns |
| Where config pulls live | `TrackerSync` | They need its lock and session fence, and F4's config ops will flush there too |

## Decisions made in F2

| Question | Decision | Why |
|---|---|---|
| Room v8 → v9 | Clean reset: destructive from 1–8, no legacy int paths (user) | The app is unreleased; the emulator's outbox was empty. Keeps F2 free of placeholder keys and int→uuid lookups. |
| Old placed widgets | Show "choose a habit" (their int key is never read) | Follows from the reset; one tap fixes it. |
| `exercise-log.json` (`PATCH /exercise-logs/:id`) | No longer recorded; the PATCH still seeds the sessions contract | Web-only route without the uuids (generic CRUD router); contracts cover what the app reads. Follow-up filed. |
| Frozen error ids | `HabitFrozen`/`CustomExerciseFrozen` carry nothing | Nothing read them; holding an int id would break F-D1. |
| Stacked volume order | First logged first (was ascending id, like the web) | No ids on Android; uuid order would be arbitrary. Colors can differ from the web's (follow-up). |
| Unknown exercise in the volume legend | The "unknown exercise" string | `#<uuid>` would be noise. |
| Where a create's uuid comes from | The form/dialog, kept across retries; repositories require it | Idempotent retries now, and the shape F4's outbox needs. |

## Decisions made in F1

| Question | Decision | Why |
|---|---|---|
| Wire form of uuid refs | Separate fields (`habitUuid`) and `/uuid/:uuid` paths, exactly one of id/uuid (user's F-D4 choice) | The D2 session routes' pattern; typed and explicit; the web is untouched. |
| Source keys | `list:<uuid>`, stored preferences rewritten by 0017, `list:<int>` refused | A list created offline must be pickable before the server knows its id; one key form, no legacy parse path. |
| Retried create at the cap | Answers the existing row before the limit check | Otherwise a lost response at the cap turns a success into a refusal (F-D3 would mark it failed). |
| Reorder with an unknown habit uuid | Skipped, like an unknown id always was | A habit deleted while a reorder waited in the outbox shouldn't fail the rest. |
| Item uuids in replace-all | A uuid the list holds keeps the row; any other is a new item with that uuid; another list's is 409 | Offline-added items keep the identity logs reference (`listItemUuid`). |
| The web's list items | Named by uuid too (`newItemInput`) | Its optimistic rows needed `uuid`/`exerciseUuid`; a client-chosen uuid gives them their final identity instead of a placeholder. |
| New contracts `day-log-ensured`, `habit-not-found-update` | Left for F2 | Android's contract tests fail on unlisted files; F2 adds them with the DTOs that read them. |

## Landmines

- **Fake `/habits` answers wipe Room.** A config pull deletes habits missing from its answer. In tests, use `trackerSync(...)` from `Fakes.kt` (`/habits` answers what `/today` does), or habits disappear when `sync()` pulls config.
- **Repository tests must join background syncs before `db.close()`** (their `@After` does). A sync left running fails a later test with "no current transaction".
- **The dev DB has no muscle groups**, so the exercise form shows "No muscle groups yet" and the library hides its filter. That is data, not a bug.

- **Production needs 0017** (after 0008–0016) **and the backend + web of F1 together**: the new web sends item `uuid`s and reads `ref.listUuid`, which an old backend doesn't have; an old web reads `ref.listId`, which the new backend doesn't send. 0017's rewrite drops preferred keys of other users' lists (there should be none).
- **A build from before F2 installed over by F2 loses its Room data** (reset); flush its outbox first. The emulator now runs F2.
- **`assertEquals(Any, Any)` compiles int-vs-uuid comparisons**: when renaming fixtures, a missed `assertEquals(4, x.listItemUuid)` fails only at run time. Grep the tests for bare numbers next to uuid fields.
- **Room's sync guard is per (habitUuid, day)**; a habit created offline (F4) must exist in `habits` before its day logs, or the foreign keys refuse them.
- **An Android build from before F2 against the F1 backend**: works (int forms kept, keys opaque), except a preferred source it cached as `list:<int>` is refused on PATCH (400). Only the dev emulator has such a build; its account had no preferred source.
- **`/history` carries no uuid refs** (web only). If the app ever reads it, add them first.
- **Frozen-error bodies carry int ids** (`habitId`, `exerciseId`, `listId`, `listIds`); Android doesn't read them today. If F4–F6 need to say which row, add the uuid to the body (invariant above).
- The E-handoff landmines still apply (dev server restarts, emulator input, memory).

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug :core:model:test --max-workers=2   # green, 0 lint issues, 439 tests
pnpm android:generate:check                                          # 62 generated files up to date
(cd apps/frontend && npx tsc -b) && (cd apps/admin && npx tsc -b)
pnpm --filter backend test                                           # 162 tests
psql "$DATABASE_URL" -c '\d habits' | grep uuid                      # 0017 applied to local dev
```

## Open questions

- **F4: does a habit created on the device start summarized** (streak 0 from today), or unsummarized until `/today`? Unsummarized is what F3's `storeHabit` does.
- **The offline snackbar on every resume while offline** (config screens): keep it, or show it only on pull-to-refresh? Revisit in F8.

## Run log

- 2026-10-06 — Phase 4 planned (F1–F8; uuid identity everywhere, LWW per field, failed creates kept: user). E6 committed (8797597). F1: backend uuids (migration 0017, uuid-refs, every app route by uuid, `list:<uuid>` keys), web list items by uuid, contracts re-recorded with per-test uuid ranges. Backend 162 tests. Next: F2.
- 2026-10-06 — F2: Android identity by uuid (DTOs without int ids, Room v9 clean reset (user), outbox/widgets/notifications/nav by uuid, forms keep a create's uuid); contracts `day-log-ensured`, `habit-not-found-update` added, `exercise-log` dropped. 411 tests, 0 lint; backend 162. Verified on the emulator, committed (422c3c1). Next: F3.
- 2026-10-06 — F3: Room v10 holds the whole config (one habits table, two pulls; `config_pulls`); config screens read Room and open offline; writes store their answer; `sync()` pulls due config. 439 tests, 0 lint; backend unchanged. Verified on the emulator (offline after one online sync). Next: F4.
