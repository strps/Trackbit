import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import db from '../src/db/db.js'
import { exerciseListItems, exerciseLists, exerciseLogs, exercises, habits, user } from '../src/db/schema/index.js'
import { app, bearer, createHabit, dayLogsFor, post, signedInUser } from './helpers.js'

// Phase 4 (offline creation): habits, exercises, lists and list items are named by a client-chosen
// uuid on every route the Android app calls, and a create retried with its uuid makes nothing new.

const get = (token: string, path: string) => app.request(path, bearer(token))
const send = (token: string, method: string, path: string, body?: unknown) =>
    app.request(path, bearer(token, { method, ...(body !== undefined && { body: JSON.stringify(body) }) }))

async function systemExercise(name = `Exercise ${Math.random()}`) {
    const [row] = await db.insert(exercises).values({ name, category: 'strength' }).returning()
    return row
}

describe('habits by uuid', () => {
    it('makes one habit however often its create is retried', async () => {
        const u = await signedInUser()
        const uuid = randomUUID()
        const first = await post(u.token, '/api/habits', { uuid, name: 'Read' })
        const retry = await post(u.token, '/api/habits', { uuid, name: 'Read' })
        expect(first.status).toBe(201)
        expect(retry.status).toBe(201)
        const [a, b] = [await first.json(), await retry.json()]
        expect(b.id).toBe(a.id)
        expect(a.uuid).toBe(uuid)
        expect(await db.select().from(habits).where(eq(habits.userId, u.id))).toHaveLength(1)
    })

    it('answers a retry at the cap with the habit it made, not the limit', async () => {
        const u = await signedInUser()
        // The default role allows 10.
        for (let i = 0; i < 9; i++) await createHabit(u.id, { name: `Habit ${i}` })
        const uuid = randomUUID()
        expect((await post(u.token, '/api/habits', { uuid, name: 'Tenth' })).status).toBe(201)
        const retry = await post(u.token, '/api/habits', { uuid, name: 'Tenth' })
        expect(retry.status).toBe(201)
        expect((await retry.json()).uuid).toBe(uuid)
    })

    it("refuses another user's uuid", async () => {
        const owner = await signedInUser()
        const taken = await createHabit(owner.id)
        const intruder = await signedInUser()
        const res = await post(intruder.token, '/api/habits', { uuid: taken.uuid, name: 'Mine' })
        expect(res.status).toBe(409)
        expect((await res.json()).error).toBe('uuid_conflict')
    })

    it('updates only the fields given, and deletes, by uuid', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { name: 'Read', weeklyGoal: 3, icon: 'book' })
        // Two edits of different fields, as from two clients: both survive.
        expect((await send(u.token, 'PUT', `/api/habits/uuid/${habit.uuid}`, { name: 'Read more' })).status).toBe(200)
        const res = await send(u.token, 'PUT', `/api/habits/uuid/${habit.uuid}`, { weeklyGoal: 6 })
        expect(await res.json()).toMatchObject({ id: habit.id, name: 'Read more', weeklyGoal: 6, icon: 'book' })

        const deleted = await send(u.token, 'DELETE', `/api/habits/uuid/${habit.uuid}`)
        expect(await deleted.json()).toEqual({ success: true, deletedId: habit.id, uuid: habit.uuid })
        // A retried delete finds nothing.
        expect((await send(u.token, 'DELETE', `/api/habits/uuid/${habit.uuid}`)).status).toBe(404)
        expect((await send(u.token, 'PUT', `/api/habits/uuid/${habit.uuid}`, { name: 'Gone' })).status).toBe(404)
    })

    it("doesn't reach another user's habit by uuid", async () => {
        const owner = await signedInUser()
        const habit = await createHabit(owner.id)
        const intruder = await signedInUser()
        expect((await send(intruder.token, 'PUT', `/api/habits/uuid/${habit.uuid}`, { name: 'Mine' })).status).toBe(404)
        expect((await send(intruder.token, 'DELETE', `/api/habits/uuid/${habit.uuid}`)).status).toBe(404)
    })

    it('reorders by uuid, skipping a habit deleted meanwhile', async () => {
        const u = await signedInUser()
        const a = await createHabit(u.id, { name: 'A', order: 0 })
        const b = await createHabit(u.id, { name: 'B', order: 1 })
        const res = await send(u.token, 'PATCH', '/api/habits/reorder', {
            items: [
                { uuid: b.uuid, order: 0, isAntiHabit: false },
                { uuid: a.uuid, order: 1, isAntiHabit: false },
                { uuid: randomUUID(), order: 2, isAntiHabit: false },
            ],
        })
        expect(res.status).toBe(200)
        const rows = await db.select({ id: habits.id, order: habits.order }).from(habits).where(eq(habits.userId, u.id))
        expect(new Map(rows.map((r) => [r.id, r.order]))).toEqual(new Map([[a.id, 1], [b.id, 0]]))
    })

    it('returns the uuid on /today', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)
        const today = await (await get(u.token, '/api/tracker/today')).json()
        expect(today.habits[0]).toMatchObject({ id: habit.id, uuid: habit.uuid })
    })
})

describe('tracker writes by habit uuid', () => {
    it('logs by habitUuid and answers with it', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)
        const res = await post(u.token, '/api/tracker/check/increment', { habitUuid: habit.uuid, delta: 2, day: '2026-01-10' })
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ habitId: habit.id, habitUuid: habit.uuid, rating: 2, localDay: '2026-01-10' })
        expect(await (await post(u.token, '/api/tracker/check', { habitUuid: habit.uuid, rating: 5, day: '2026-01-10' })).json())
            .toMatchObject({ rating: 5, habitUuid: habit.uuid })
        expect(await (await post(u.token, '/api/tracker/day-logs/ensure', { habitUuid: habit.uuid, day: '2026-01-11' })).json())
            .toMatchObject({ rating: null, habitUuid: habit.uuid })
        expect(await dayLogsFor(habit.id)).toHaveLength(2)
    })

    it('takes exactly one of habitId and habitUuid', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)
        expect((await post(u.token, '/api/tracker/check', { habitId: habit.id, habitUuid: habit.uuid, rating: 1 })).status).toBe(400)
        expect((await post(u.token, '/api/tracker/check', { rating: 1 })).status).toBe(400)
    })

    it("answers 404 for another user's habit uuid", async () => {
        const owner = await signedInUser()
        const habit = await createHabit(owner.id)
        const intruder = await signedInUser()
        const res = await post(intruder.token, '/api/tracker/check/increment', { habitUuid: habit.uuid, delta: 1 })
        expect(res.status).toBe(404)
        expect((await get(intruder.token, `/api/tracker/sets?habitUuid=${habit.uuid}`)).status).toBe(404)
        expect(await dayLogsFor(habit.id)).toHaveLength(0)
    })

    it('runs a session naming habit, exercise and list item by uuid', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { type: 'complex' })
        const bench = await systemExercise()
        const [list] = await db.insert(exerciseLists).values({ userId: u.id, authorId: u.id, name: 'Push' }).returning()
        const [item] = await db.insert(exerciseListItems).values({ listId: list.id, exerciseId: bench.id, position: 0 }).returning()

        const session = randomUUID()
        const log = randomUUID()
        expect((await post(u.token, '/api/tracker/exercise-sessions', { uuid: session, habitUuid: habit.uuid, day: '2026-01-10' })).status).toBe(201)
        const created = await post(u.token, '/api/tracker/exercise-logs', {
            uuid: log, exerciseSessionUuid: session, exerciseUuid: bench.uuid, listItemUuid: item.uuid,
        })
        expect(created.status).toBe(200)
        expect(await created.json()).toMatchObject({
            uuid: log, exerciseId: bench.id, exerciseUuid: bench.uuid, listItemId: item.id, listItemUuid: item.uuid,
        })
        // A retry answers with the same uuids.
        expect(await (await post(u.token, '/api/tracker/exercise-logs', {
            uuid: log, exerciseSessionUuid: session, exerciseUuid: bench.uuid, listItemUuid: item.uuid,
        })).json()).toMatchObject({ exerciseUuid: bench.uuid, listItemUuid: item.uuid })

        const day = await (await get(u.token, `/api/tracker/exercise-sessions?habitUuid=${habit.uuid}&day=2026-01-10`)).json()
        expect(day[0].exerciseLogs[0]).toMatchObject({ uuid: log, exerciseUuid: bench.uuid, listItemUuid: item.uuid })
    })

    it("refuses another user's exercise and list item by uuid", async () => {
        const u = await signedInUser()
        const other = await signedInUser()
        const habit = await createHabit(u.id, { type: 'complex' })
        const [theirs] = await db.insert(exercises).values({ name: 'Theirs', userId: other.id }).returning()
        const [theirList] = await db.insert(exerciseLists).values({ userId: other.id, authorId: other.id, name: 'Theirs' }).returning()
        const [theirItem] = await db.insert(exerciseListItems).values({ listId: theirList.id, exerciseId: theirs.id, position: 0 }).returning()
        const bench = await systemExercise()
        const session = randomUUID()
        await post(u.token, '/api/tracker/exercise-sessions', { uuid: session, habitUuid: habit.uuid })

        expect((await post(u.token, '/api/tracker/exercise-logs', { exerciseSessionUuid: session, exerciseUuid: theirs.uuid })).status).toBe(404)
        const item = await post(u.token, '/api/tracker/exercise-logs', { exerciseSessionUuid: session, exerciseUuid: bench.uuid, listItemUuid: theirItem.uuid })
        expect(item.status).toBe(400)
        expect(await item.json()).toMatchObject({ error: 'exercise_list_item_not_found', listItemUuid: theirItem.uuid })
        expect(await db.select().from(exerciseLogs)).not.toContainEqual(expect.objectContaining({ listItemId: theirItem.id }))
    })
})

describe('exercises by uuid', () => {
    it('makes one exercise per uuid and edits and deletes it by uuid', async () => {
        const u = await signedInUser()
        const uuid = randomUUID()
        const body = { uuid, name: 'Dips', category: 'strength' }
        const first = await (await post(u.token, '/api/exercise-info/exercises', body)).json()
        const retry = await post(u.token, '/api/exercise-info/exercises', body)
        expect(retry.status).toBe(201)
        expect((await retry.json()).id).toBe(first.id)
        expect(first.uuid).toBe(uuid)

        const updated = await send(u.token, 'PATCH', `/api/exercise-info/exercises/uuid/${uuid}`, { description: 'Lean forward' })
        expect(await updated.json()).toMatchObject({ uuid, name: 'Dips', description: 'Lean forward' })
        expect(await (await send(u.token, 'DELETE', `/api/exercise-info/exercises/uuid/${uuid}`)).json())
            .toEqual({ success: true, id: first.id, uuid })
        expect((await send(u.token, 'DELETE', `/api/exercise-info/exercises/uuid/${uuid}`)).status).toBe(404)
    })

    it("can't edit a system exercise or another user's by uuid", async () => {
        const u = await signedInUser()
        const other = await signedInUser()
        const bench = await systemExercise()
        const [theirs] = await db.insert(exercises).values({ name: 'Theirs', userId: other.id }).returning()
        expect((await send(u.token, 'PATCH', `/api/exercise-info/exercises/uuid/${bench.uuid}`, { name: 'Mine' })).status).toBe(404)
        expect((await send(u.token, 'PATCH', `/api/exercise-info/exercises/uuid/${theirs.uuid}`, { name: 'Mine' })).status).toBe(404)
        expect((await send(u.token, 'DELETE', `/api/exercise-info/exercises/uuid/${theirs.uuid}`)).status).toBe(404)
        const res = await post(u.token, '/api/exercise-info/exercises', { uuid: theirs.uuid, name: 'Mine', category: 'strength' })
        expect(res.status).toBe(409)
    })

    it('lists every exercise with its uuid', async () => {
        const u = await signedInUser()
        const bench = await systemExercise()
        const list = await (await get(u.token, '/api/exercise-info/exercises')).json()
        expect(list.find((e: { id: number }) => e.id === bench.id).uuid).toBe(bench.uuid)
    })
})

describe('exercise lists by uuid', () => {
    const LISTS = '/api/exercise-lists'

    it('makes one list per uuid, and reads, renames and deletes it by uuid', async () => {
        const u = await signedInUser()
        const uuid = randomUUID()
        const first = await (await post(u.token, LISTS, { uuid, name: 'Push' })).json()
        const retry = await post(u.token, LISTS, { uuid, name: 'Push' })
        expect(retry.status).toBe(201)
        expect(await retry.json()).toMatchObject({ id: first.id, uuid, items: [], frozen: false })

        expect(await (await get(u.token, `${LISTS}/uuid/${uuid}`)).json()).toMatchObject({ id: first.id, name: 'Push' })
        expect(await (await send(u.token, 'PATCH', `${LISTS}/uuid/${uuid}`, { description: 'Chest' })).json())
            .toMatchObject({ name: 'Push', description: 'Chest' })
        expect(await (await send(u.token, 'DELETE', `${LISTS}/uuid/${uuid}`)).json()).toEqual({ success: true, deletedId: first.id, uuid })
        expect((await get(u.token, `${LISTS}/uuid/${uuid}`)).status).toBe(404)
    })

    it('keeps items by uuid and creates new ones with the uuid given', async () => {
        const u = await signedInUser()
        const [squat, press] = [await systemExercise(), await systemExercise()]
        const list = await (await post(u.token, LISTS, { uuid: randomUUID(), name: 'Legs' })).json()
        const kept = randomUUID()
        const first = await (await send(u.token, 'PUT', `${LISTS}/uuid/${list.uuid}/items`, {
            items: [{ uuid: kept, exerciseUuid: squat.uuid, position: 0, targetSets: 5 }],
        })).json()
        const keptId = first.items[0].id
        expect(first).toMatchObject({ listId: list.id, listUuid: list.uuid, items: [{ uuid: kept, exerciseId: squat.id, exerciseUuid: squat.uuid }] })

        const added = randomUUID()
        const second = await (await send(u.token, 'PUT', `${LISTS}/uuid/${list.uuid}/items`, {
            items: [
                { uuid: added, exerciseUuid: press.uuid, position: 0 },
                { uuid: kept, exerciseUuid: squat.uuid, position: 1, targetSets: 3 },
            ],
        })).json()
        expect(second.items).toMatchObject([
            { uuid: added, exerciseUuid: press.uuid, position: 0 },
            { id: keptId, uuid: kept, position: 1, targetSets: 3 },
        ])
    })

    it("refuses an item uuid another list holds and an exercise the user can't use", async () => {
        const u = await signedInUser()
        const other = await signedInUser()
        const squat = await systemExercise()
        const [theirs] = await db.insert(exercises).values({ name: 'Theirs', userId: other.id }).returning()
        const a = await (await post(u.token, LISTS, { uuid: randomUUID(), name: 'A' })).json()
        const b = await (await post(u.token, LISTS, { uuid: randomUUID(), name: 'B' })).json()
        const item = randomUUID()
        await post(u.token, `${LISTS}/uuid/${a.uuid}/items`, { uuid: item, exerciseUuid: squat.uuid })

        expect((await send(u.token, 'PUT', `${LISTS}/uuid/${b.uuid}/items`, {
            items: [{ uuid: item, exerciseUuid: squat.uuid, position: 0 }],
        })).status).toBe(409)
        expect((await post(u.token, `${LISTS}/uuid/${b.uuid}/items`, { uuid: item, exerciseUuid: squat.uuid })).status).toBe(409)
        const unavailable = await post(u.token, `${LISTS}/uuid/${b.uuid}/items`, { exerciseUuid: theirs.uuid })
        expect(unavailable.status).toBe(400)
        expect((await unavailable.json()).error).toBe('exercise_not_available')
    })

    it('appends once however often the append is retried', async () => {
        const u = await signedInUser()
        const squat = await systemExercise()
        const list = await (await post(u.token, LISTS, { uuid: randomUUID(), name: 'Legs' })).json()
        const uuid = randomUUID()
        await post(u.token, `${LISTS}/uuid/${list.uuid}/items`, { uuid, exerciseUuid: squat.uuid })
        const retry = await post(u.token, `${LISTS}/uuid/${list.uuid}/items`, { uuid, exerciseUuid: squat.uuid })
        expect(retry.status).toBe(201)
        expect((await retry.json()).items).toMatchObject([{ uuid, exerciseUuid: squat.uuid }])
    })

    it('reorders by uuid', async () => {
        const u = await signedInUser()
        const a = await (await post(u.token, LISTS, { uuid: randomUUID(), name: 'A' })).json()
        const b = await (await post(u.token, LISTS, { uuid: randomUUID(), name: 'B' })).json()
        const res = await send(u.token, 'PATCH', `${LISTS}/reorder`, { uuids: [b.uuid, a.uuid] })
        expect((await res.json()).map((l: { uuid: string }) => l.uuid)).toEqual([b.uuid, a.uuid])
        const missing = await send(u.token, 'PATCH', `${LISTS}/reorder`, { uuids: [b.uuid, randomUUID()] })
        expect((await missing.json()).error).toBe('exercise_list_order_mismatch')
    })

    it("doesn't reach another user's list by uuid", async () => {
        const owner = await signedInUser()
        const list = await (await post(owner.token, LISTS, { uuid: randomUUID(), name: 'Mine' })).json()
        const intruder = await signedInUser()
        expect((await get(intruder.token, `${LISTS}/uuid/${list.uuid}`)).status).toBe(404)
        expect((await send(intruder.token, 'PATCH', `${LISTS}/uuid/${list.uuid}`, { name: 'Theirs' })).status).toBe(404)
        expect((await send(intruder.token, 'DELETE', `${LISTS}/uuid/${list.uuid}`)).status).toBe(404)
        expect((await post(intruder.token, LISTS, { uuid: list.uuid, name: 'Theirs' })).status).toBe(409)
    })
})

describe('exercise sources by list uuid', () => {
    it('keys a list by its uuid and resolves its queue with uuids', async () => {
        const u = await signedInUser()
        const squat = await systemExercise()
        const list = await (await post(u.token, '/api/exercise-lists', { uuid: randomUUID(), name: 'Legs' })).json()
        const item = randomUUID()
        await post(u.token, `/api/exercise-lists/uuid/${list.uuid}/items`, { uuid: item, exerciseUuid: squat.uuid })

        const [source] = await (await get(u.token, '/api/exercise-sources')).json()
        expect(source).toMatchObject({ key: `list:${list.uuid}`, ref: { kind: 'list', listUuid: list.uuid } })
        const queue = await (await get(u.token, `/api/exercise-sources/list:${list.uuid}`)).json()
        expect(queue.entries).toMatchObject([{ exerciseUuid: squat.uuid, listItemUuid: item }])
        // The old key form names nothing now.
        expect((await get(u.token, `/api/exercise-sources/list:${list.id}`)).status).toBe(400)
    })

    it('stores a preferred source by list uuid only', async () => {
        const u = await signedInUser()
        const list = await (await post(u.token, '/api/exercise-lists', { uuid: randomUUID(), name: 'Legs' })).json()
        expect((await send(u.token, 'PATCH', '/api/me/preferences', { preferredExerciseSource: `list:${list.uuid}` })).status).toBe(204)
        expect((await send(u.token, 'PATCH', '/api/me/preferences', { preferredExerciseSource: `list:${list.id}` })).status).toBe(400)
    })
})

describe('migration 0017', () => {
    // The statement that rewrites stored preferences, run as written in the migration.
    const rewrite = readFileSync(new URL('../drizzle/0017_config_uuids.sql', import.meta.url), 'utf8')
        .split('--> statement-breakpoint')
        .find((statement) => statement.includes('preferred_exercise_source'))!

    it('rewrites stored list keys to uuids and forgets dangling ones', async () => {
        const u = await signedInUser()
        const stale = await signedInUser()
        const other = await signedInUser()
        const [list] = await db.insert(exerciseLists).values({ userId: u.id, authorId: u.id, name: 'Legs' }).returning()
        const [theirs] = await db.insert(exerciseLists).values({ userId: other.id, authorId: other.id, name: 'Theirs' }).returning()
        await db.update(user).set({ preferredExerciseSource: `list:${list.id}` }).where(eq(user.id, u.id))
        // Someone else's list, which the old key could name: forgotten, not rewritten.
        await db.update(user).set({ preferredExerciseSource: `list:${theirs.id}` }).where(eq(user.id, stale.id))
        await db.update(user).set({ preferredExerciseSource: 'computed:agent-v1' }).where(eq(user.id, other.id))

        await db.execute(sql.raw(rewrite))

        const prefs = new Map((await db.select({ id: user.id, source: user.preferredExerciseSource }).from(user)).map((r) => [r.id, r.source]))
        expect(prefs.get(u.id)).toBe(`list:${list.uuid}`)
        expect(prefs.get(stale.id)).toBeNull()
        expect(prefs.get(other.id)).toBe('computed:agent-v1')
    })
})
