# Handoff: Kotlin app — Workstream F (full offline capability)

- **Plan:** [kotlin-app.md](../tasks/kotlin-app.md). Read only §4 "Phase 4" (decisions F-D1–F-D4 and the F1–F8 split) and §2.2. Core context: the "Invariants" and "Landmines" of [kotlin-app-E.md](kotlin-app-E.md), [kotlin-app-D.md](kotlin-app-D.md), [kotlin-app-C.md](kotlin-app-C.md) and [kotlin-app-B.md](kotlin-app-B.md), nothing else.
- **Status:** Phase 4, F1 done (backend, not committed yet); **F2 (Android identity by uuid) is next**. Phase 2 and Phase 3 exit checks are deferred to the final pass with the real-device check (user).
- **Branch:** `kotlin-app` · **Last run:** 2026-10-06 (F1)

## Where we are

The server names habits, exercises, exercise lists and list items by a client-chosen `uuid` as well as by their int `id`, the way D2 did for sessions, logs and sets. A create given a `uuid` is idempotent: a retry, even at the cap, answers 201 with the row it made the first time, and another user's uuid gets a 409 `uuid_conflict`. Every route the Android app calls takes the uuid form, and every response it reads carries the uuids it needs (table below). The web keeps sending int ids. Its list editor now names items by uuid (`newItemInput`), and its "add to list" menu matches lists by `ref.listUuid`.

**List source keys are `list:<uuid>` now** (`EXERCISE_SOURCE_KEY_PATTERN`). The old `list:<int>` form is a 400. Migration 0017 rewrites stored preferences, and forgets keys whose list is gone or belongs to another user.

The Android app is unchanged apart from DecodeTest's key literals. It still sends ints and decodes the new contracts, because unknown keys are ignored.

Backend 162 tests (24 new in [config-uuids.test.ts](../../../apps/backend/test/config-uuids.test.ts)); 28 contracts re-recorded; web + admin `tsc -b` clean. Android `assembleDebug testDebugUnitTest lintDebug :core:model:test` green: 414 tests, 0 lint issues; 62 generated files up to date. Not exercised: the emulator against the F1 backend, the web list editor in a browser (tsc only).

## Phase 4 task split (F1–F8)

| Task | Scope | Status |
|---|---|---|
| **F1** | Backend uuids: migration 0017, idempotent creates, uuid refs on every route the app calls, uuids in its responses, `list:<uuid>` keys; contracts | ✅ 2026-10-06 |
| **F2** | Android identity: DTOs, Room v9, outbox, widgets, repositories, features and nav by uuid. No behaviour change | next |
| **F3** | Room holds the whole config; config screens read Room | |
| **F4** | Config outbox (field-level ops, per-row dependencies, failed state) + habits through it | |
| **F5** | Exercise library through the outbox | |
| **F6** | Lists through the outbox; offline-created lists as sources | |
| **F7** | Preferences through the outbox | |
| **F8** | Failed-create UX, offline exit check | |

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

## Next: F2 — Android names habits, exercises, lists and items by uuid

No behaviour change: after F2 the app works exactly as now, but no int id of these rows identifies anything on Android (F-D1). Probably two runs; split at step 4 if context runs low.

1. **core:model:** add `uuid` to `Habit`, `TodayHabit`, `Exercise`, `ExerciseList`, `ExerciseListItem`; `habitUuid` to `DayLog`, `Days` entries, `HabitSetsResponse`; `exerciseUuid` (+ `listItemUuid`) to `HabitSet`, session logs (`Exercise.kt` ~l.79/95), `QueueEntry`, `QueueLog`. Requests: `habitUuid` in `CheckRequest`/`IncrementRequest`/`EnsureDayLogRequest`/`CreateSessionRequest` ([TrackerRequests.kt](../../../apps/android/core/model/src/main/kotlin/com/trackbit/core/model/TrackerRequests.kt)), `exerciseUuid`/`listItemUuid` in `CreateExerciseLogRequest`, `HabitOrder(uuid, …)`, list requests (`uuids`, item `uuid`/`exerciseUuid`, append `{ uuid, exerciseUuid }`), create requests with `uuid`. Then record the two contracts F1 left out ("Landmines") and assert the uuids in DecodeTest.
2. **core:network:** services to the `/uuid/:uuid` paths and `habitUuid` queries.
3. **core:database v9:** habits keyed by `uuid` (String); `day_logs`, `outbox`, `timers`, sessions, `habit_sets`, `history`?, queue entries and the catalog reference uuids. Decide the migration first (open question below). Room schema JSON `9.json` is exported on compile (landmine in D).
4. **core:data / features / app / widget:** `TrackerRepository`, `OutboxWriter`, `OutboxOps`, `SessionRepository`, `AnalyticsRepository`, config repositories, nav routes (`HabitFormRoute`, `ExerciseFormRoute`, `ListEditorRoute`, the session route), `TimerActionReceiver`, widget action params and Glance state (`HabitIdKey` in [HabitWidgetState.kt:26](../../../apps/android/widget/src/main/kotlin/com/trackbit/widget/habit/HabitWidgetState.kt#L26) → a uuid key; a placed widget holding the old int key must be migrated on first read through Room's habit, or it loses its habit).
5. Verify, then the emulator: the D/E smoke paths (log a habit from app and widget, a session with a list pick, edit a habit, a list) still work against the local backend.

Start with [Exercise.kt](../../../apps/android/core/model/src/main/kotlin/com/trackbit/core/model/Exercise.kt) and [TrackerRequests.kt](../../../apps/android/core/model/src/main/kotlin/com/trackbit/core/model/TrackerRequests.kt): the wire shapes everything else follows.

## Invariants — do not break these

(Plus those in the B, C, D and E handoffs.)

- **Rows a client may create offline carry a client-chosen `uuid`** (habits, exercises, lists, list items; sessions, logs, sets since D2). A create given one is idempotent and answers 201 with the first row, checked **before** limits; another user's uuid is 409 `uuid_conflict`. New such tables follow [uuid-refs.ts](../../../apps/backend/src/lib/uuid-refs.ts).
- **Every route the app calls takes the uuid form**, exactly one of id/uuid (`oneOf`), resolved among the rows the user may see; an unknown or foreign uuid answers like an unknown id (404, or the route's own "not found"/"not available" error). Keep the int forms for the web.
- **Responses carry the uuid beside each int reference the app reads** (`habitUuid`, `exerciseUuid`, `listItemUuid`, `listUuid`). Adding a reference the app reads means adding its uuid too.
- **Config updates apply only the fields given** (F-D2: last write wins per field). Never turn an update into a replace.
- **List source keys are `list:<uuid>`**; the pattern in `@trackbit/types` is the only definition. The app still never parses a key (D invariant); F6 may build `list:<uuid>` for a list created offline, and that is the only place allowed to.
- **Contract client uuids come from the test's own range** (`uuidsFrom(base)`); never a global counter, never random.

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

- **Production needs 0017** (after 0008–0016) **and the backend + web of F1 together**: the new web sends item `uuid`s and reads `ref.listUuid`, which an old backend doesn't have; an old web reads `ref.listId`, which the new backend doesn't send. 0017's rewrite drops preferred keys of other users' lists (there should be none).
- **An Android build from before F2 against the F1 backend**: works (int forms kept, keys opaque), except a preferred source it cached as `list:<int>` is refused on PATCH (400). Only the dev emulator has such a build; its account had no preferred source.
- **Two contracts to record in F2**: `day-log-ensured.json` (`POST /day-logs/ensure` by `habitUuid`) and `habit-not-found-update.json` (`PUT /api/habits/uuid/<unknown>` → 404). Add each to DecodeTest/ErrorContractTest in the same change, or those tests fail on the unlisted file.
- **`/history` carries no uuid refs** (web only). If the app ever reads it, add them first.
- **Frozen-error bodies carry int ids** (`habitId`, `exerciseId`, `listId`, `listIds`); Android doesn't read them today. If F4–F6 need to say which row, add the uuid to the body (invariant above).
- The E-handoff landmines still apply (dev server restarts, emulator input, memory).

## Verify

```bash
cd apps/android && ./gradlew --stop
./gradlew assembleDebug testDebugUnitTest lintDebug :core:model:test --max-workers=2   # green, 0 lint issues, 414 tests
pnpm android:generate:check                                          # 62 generated files up to date
(cd apps/frontend && npx tsc -b) && (cd apps/admin && npx tsc -b)
pnpm --filter backend test                                           # 162 tests
psql "$DATABASE_URL" -c '\d habits' | grep uuid                      # 0017 applied to local dev
```

## Open questions

- **F2: Room v9 and ops queued before it** (decide at the start of F2; default below). Room has no uuids before v9 and can't learn them offline, so a pending op written with an int `habitId` can't be rekeyed. Default: v9 clears the server-data tables (they re-pull) and keeps `outbox` and `timers`; a legacy op keeps its int payload (the server still takes `habitId`) and the migration gives its row a placeholder key that no pull guards, accepting a moment of stale display until it flushes. The app is unreleased (only the dev emulator has data), so a simpler "refuse to migrate with a non-empty outbox, flush first" is also acceptable. Ask the user if neither fits.

## Run log

- 2026-10-06 — Phase 4 planned (F1–F8; uuid identity everywhere, LWW per field, failed creates kept: user). E6 committed (8797597). F1: backend uuids (migration 0017, uuid-refs, every app route by uuid, `list:<uuid>` keys), web list items by uuid, contracts re-recorded with per-test uuid ranges. Backend 162 tests. Next: F2.
