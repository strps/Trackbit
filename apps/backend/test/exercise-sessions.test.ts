import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import db from '../src/db/db.js'
import { dayLogs, exerciseLogs, exercisePerformances, exercises, exerciseSessions } from '../src/db/schema/index.js'
import { generateCrudRouter } from '../src/lib/utilities/crud-router-factory.js'
import { defineCrudSchemas } from '../src/lib/utilities/drizzle-crud-schemas.js'
import { app, bearer, createHabit, dayLogsFor, post, signedInUser } from './helpers.js'

const get = (token: string, path: string) => app.request(path, bearer(token))
const send = (token: string, method: string, path: string, body?: unknown) =>
    app.request(path, bearer(token, { method, ...(body !== undefined && { body: JSON.stringify(body) }) }))

async function systemExercise(name = `Exercise ${Math.random()}`) {
    const [row] = await db.insert(exercises).values({ name, category: 'strength' }).returning()
    return row
}

/** A user with a complex habit, a session on 2026-01-10, one log and one set. */
async function workout() {
    const u = await signedInUser()
    const habit = await createHabit(u.id, { type: 'complex' })
    const exercise = await systemExercise()
    const session = await (await post(u.token, '/api/tracker/exercise-sessions', { habitId: habit.id, day: '2026-01-10' })).json()
    const log = await (await post(u.token, '/api/tracker/exercise-logs', { exerciseSessionId: session.id, exerciseId: exercise.id })).json()
    const set = await (await post(u.token, '/api/tracker/exercise-performances', { exerciseLogId: log.id, number: 1, reps: 5 })).json()
    return { u, habit, exercise, session, log, set }
}

describe('POST /api/tracker/exercise-sessions', () => {
    it('by habit and day creates the day log if needed', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { type: 'complex' })

        const res = await post(u.token, '/api/tracker/exercise-sessions', { habitId: habit.id, day: '2026-01-10' })
        expect(res.status).toBe(201)
        const session = await res.json()
        const [log] = await dayLogsFor(habit.id)
        expect(log).toMatchObject({ localDay: '2026-01-10', rating: null })
        expect(session.dayLogId).toBe(log.id)

        // A second session reuses the day's log.
        await post(u.token, '/api/tracker/exercise-sessions', { habitId: habit.id, day: '2026-01-10' })
        expect(await dayLogsFor(habit.id)).toHaveLength(1)
        expect(await db.select().from(exerciseSessions).where(eq(exerciseSessions.dayLogId, log.id))).toHaveLength(2)
    })

    it('replays a retry with the same Idempotency-Key instead of creating another', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { type: 'complex' })
        const body = { habitId: habit.id, day: '2026-01-10' }

        const first = await (await post(u.token, '/api/tracker/exercise-sessions', body, { 'idempotency-key': 's-1' })).json()
        const retry = await post(u.token, '/api/tracker/exercise-sessions', body, { 'idempotency-key': 's-1' })
        expect(retry.headers.get('idempotent-replayed')).toBe('true')
        expect((await retry.json()).id).toBe(first.id)
        expect(await db.select().from(exerciseSessions).where(eq(exerciseSessions.dayLogId, first.dayLogId))).toHaveLength(1)
    })

    it("rejects another user's habit or day log with 404", async () => {
        const owner = await signedInUser()
        const intruder = await signedInUser()
        const habit = await createHabit(owner.id, { type: 'complex' })
        const log = await (await post(owner.token, '/api/tracker/day-logs/ensure', { habitId: habit.id })).json()

        expect((await post(intruder.token, '/api/tracker/exercise-sessions', { habitId: habit.id })).status).toBe(404)
        expect((await post(intruder.token, '/api/tracker/exercise-sessions', { dayLogId: log.id })).status).toBe(404)
        expect(await db.select().from(exerciseSessions).where(eq(exerciseSessions.dayLogId, log.id))).toHaveLength(0)
    })

    it('rejects a frozen habit with habit_frozen', async () => {
        const u = await signedInUser()
        // 'timed' is not in the default role's allowedHabitTypes, so it is frozen.
        const habit = await createHabit(u.id, { type: 'timed' })

        const res = await post(u.token, '/api/tracker/exercise-sessions', { habitId: habit.id })
        expect(res.status).toBe(403)
        expect(await res.json()).toMatchObject({ error: 'habit_frozen', habitId: habit.id })
        expect(await dayLogsFor(habit.id)).toHaveLength(0)
    })

    it('takes a day log id or a habit, not both', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { type: 'complex' })
        const log = await (await post(u.token, '/api/tracker/day-logs/ensure', { habitId: habit.id })).json()

        expect((await post(u.token, '/api/tracker/exercise-sessions', { dayLogId: log.id, habitId: habit.id })).status).toBe(400)
    })

    it('cannot be moved to another day log', async () => {
        const { u, session } = await workout()
        expect((await send(u.token, 'PATCH', `/api/tracker/exercise-sessions/${session.id}`, { dayLogId: 1 })).status).toBe(404)
    })
})

describe('GET /api/tracker/exercise-sessions', () => {
    it("returns one day's sessions with their logs and sets, oldest first", async () => {
        const { u, habit, exercise, session, log, set } = await workout()
        const second = await (await post(u.token, '/api/tracker/exercise-sessions', { habitId: habit.id, day: '2026-01-10' })).json()
        const set2 = await (await post(u.token, '/api/tracker/exercise-performances', { exerciseLogId: log.id, number: 2, reps: 3 })).json()
        // Another day's session stays out.
        await post(u.token, '/api/tracker/exercise-sessions', { habitId: habit.id, day: '2026-01-11' })

        const res = await get(u.token, `/api/tracker/exercise-sessions?habitId=${habit.id}&day=2026-01-10`)
        expect(res.status).toBe(200)
        const sessions = await res.json()
        expect(sessions.map((s: { id: number }) => s.id)).toEqual([session.id, second.id])
        expect(sessions[0].exerciseLogs).toHaveLength(1)
        expect(sessions[0].exerciseLogs[0]).toMatchObject({ id: log.id, exerciseId: exercise.id })
        expect(sessions[0].exerciseLogs[0].exercisePerformances.map((p: { id: number }) => p.id)).toEqual([set.id, set2.id])
        expect(sessions[1].exerciseLogs).toEqual([])
    })

    it('is empty for a day without a log', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { type: 'complex' })
        expect(await (await get(u.token, `/api/tracker/exercise-sessions?habitId=${habit.id}&day=2026-01-10`)).json()).toEqual([])
    })

    it("rejects another user's habit with 404 and a missing day with 400", async () => {
        const { habit } = await workout()
        const intruder = await signedInUser()
        expect((await get(intruder.token, `/api/tracker/exercise-sessions?habitId=${habit.id}&day=2026-01-10`)).status).toBe(404)
        expect((await get(intruder.token, `/api/tracker/exercise-sessions?habitId=${habit.id}`)).status).toBe(400)
    })
})

describe('exercise logs and sets', () => {
    it("can't be created under another user's session or log", async () => {
        const { session, log, exercise } = await workout()
        const intruder = await signedInUser()

        expect((await post(intruder.token, '/api/tracker/exercise-logs', { exerciseSessionId: session.id, exerciseId: exercise.id })).status).toBe(404)
        expect((await post(intruder.token, '/api/tracker/exercise-performances', { exerciseLogId: log.id, number: 2, reps: 1 })).status).toBe(404)
        expect(await db.select().from(exerciseLogs).where(eq(exerciseLogs.exerciseSessionId, session.id))).toHaveLength(1)
        expect(await db.select().from(exercisePerformances).where(eq(exercisePerformances.exerciseLogId, log.id))).toHaveLength(1)
    })

    it("can't log another user's custom exercise", async () => {
        const { session, u } = await workout()
        const other = await signedInUser()
        const [custom] = await db.insert(exercises).values({ name: 'Secret', userId: other.id }).returning()

        expect((await post(u.token, '/api/tracker/exercise-logs', { exerciseSessionId: session.id, exerciseId: custom.id })).status).toBe(404)
    })

    it("can't be moved under another user's session or log", async () => {
        const { u, log, set } = await workout()
        const other = await workout()

        const movedLog = await send(u.token, 'PATCH', `/api/tracker/exercise-logs/${log.id}`, { exerciseSessionId: other.session.id, duration: 60 })
        const movedSet = await send(u.token, 'PATCH', `/api/tracker/exercise-performances/${set.id}`, { exerciseLogId: other.log.id, reps: 9 })
        expect([movedLog.status, movedSet.status]).toEqual([400, 400])

        const [logRow] = await db.select().from(exerciseLogs).where(eq(exerciseLogs.id, log.id))
        const [setRow] = await db.select().from(exercisePerformances).where(eq(exercisePerformances.id, set.id))
        expect(logRow).toMatchObject({ exerciseSessionId: log.exerciseSessionId, duration: null })
        expect(setRow).toMatchObject({ exerciseLogId: log.id, reps: 5 })
    })

    it('replays a set retried with the same Idempotency-Key', async () => {
        const { u, log } = await workout()
        const body = { exerciseLogId: log.id, number: 2, reps: 4 }

        const first = await (await post(u.token, '/api/tracker/exercise-performances', body, { 'idempotency-key': 'p-1' })).json()
        const retry = await (await post(u.token, '/api/tracker/exercise-performances', body, { 'idempotency-key': 'p-1' })).json()
        expect(retry.id).toBe(first.id)
        expect(await db.select().from(exercisePerformances).where(eq(exercisePerformances.exerciseLogId, log.id))).toHaveLength(2)
    })

    it("are frozen with their habit", async () => {
        const { u, habit, log, set } = await workout()
        // Freezes it: the default role can't have timed habits.
        await db.execute(`update habits set type = 'timed' where id = ${habit.id}`)

        const created = await post(u.token, '/api/tracker/exercise-performances', { exerciseLogId: log.id, number: 2 })
        expect(created.status).toBe(403)
        expect(await created.json()).toMatchObject({ error: 'habit_frozen', habitId: habit.id })
        expect((await send(u.token, 'PATCH', `/api/tracker/exercise-performances/${set.id}`, { reps: 1 })).status).toBe(403)
    })
})

describe('owned tables without a userId column', () => {
    it('have no list routes', async () => {
        const { u } = await workout()
        for (const path of ['day-logs', 'exercise-logs', 'exercise-performances']) {
            expect((await get(u.token, `/api/tracker/${path}`)).status).toBe(404)
        }
        // Without habitId and day the sessions list is a validation error, not every session.
        expect((await get(u.token, '/api/tracker/exercise-sessions')).status).toBe(400)
    })

    it("can't get a generated list", () => {
        expect(() => generateCrudRouter({
            table: dayLogs,
            schemas: defineCrudSchemas(dayLogs, {}),
            primaryKeyFields: ['id'],
            ownershipCheck: () => true,
        })).toThrow(/list/)
    })
})

describe('client uuids', () => {
    /** What an offline client queues: a session, a log and a set, each naming its parent by uuid. */
    async function offlineWorkout() {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { type: 'complex' })
        const exercise = await systemExercise()
        const ids = { session: crypto.randomUUID(), log: crypto.randomUUID(), set: crypto.randomUUID() }
        const requests = {
            session: () => post(u.token, '/api/tracker/exercise-sessions', { uuid: ids.session, habitId: habit.id, day: '2026-01-10' }),
            log: () => post(u.token, '/api/tracker/exercise-logs', { uuid: ids.log, exerciseSessionUuid: ids.session, exerciseId: exercise.id }),
            set: () => post(u.token, '/api/tracker/exercise-performances', { uuid: ids.set, exerciseLogUuid: ids.log, number: 1, reps: 5, weight: 20 }),
        }
        return { u, habit, ids, requests }
    }

    it('create a tree whose children name their parents by uuid', async () => {
        const { u, habit, ids, requests } = await offlineWorkout()
        expect((await requests.session()).status).toBe(201)
        expect((await requests.log()).status).toBe(200)
        expect((await requests.set()).status).toBe(201)

        const [session] = await (await get(u.token, `/api/tracker/exercise-sessions?habitId=${habit.id}&day=2026-01-10`)).json()
        expect(session.uuid).toBe(ids.session)
        expect(session.exerciseLogs[0].uuid).toBe(ids.log)
        expect(session.exerciseLogs[0].exercisePerformances[0]).toMatchObject({ uuid: ids.set, reps: 5, weight: 20 })
    })

    it('make a retried create return the first row, even without an Idempotency-Key', async () => {
        const { requests } = await offlineWorkout()
        for (const create of [requests.session, requests.log, requests.set]) {
            const first = await (await create()).json()
            const retry = await (await create()).json()
            expect(retry.id).toBe(first.id)
        }
        expect(await db.select().from(exerciseSessions)
            .where(eq(exerciseSessions.uuid, (await (await requests.session()).json()).uuid))).toHaveLength(1)
    })

    it('reject a uuid already used under another parent', async () => {
        const { u, habit, ids, requests } = await offlineWorkout()
        await requests.session()
        const res = await post(u.token, '/api/tracker/exercise-sessions', { uuid: ids.session, habitId: habit.id, day: '2026-01-11' })
        expect(res.status).toBe(409)
        expect(await res.json()).toMatchObject({ error: 'uuid_conflict' })
    })

    it("can't reach another user's rows", async () => {
        const { ids, requests } = await offlineWorkout()
        await requests.session(); await requests.log(); await requests.set()
        const intruder = await signedInUser()
        const exercise = await systemExercise()

        expect((await post(intruder.token, '/api/tracker/exercise-logs', { exerciseSessionUuid: ids.session, exerciseId: exercise.id })).status).toBe(404)
        expect((await post(intruder.token, '/api/tracker/exercise-performances', { exerciseLogUuid: ids.log, number: 2 })).status).toBe(404)
        expect((await send(intruder.token, 'PATCH', `/api/tracker/exercise-performances/uuid/${ids.set}`, { reps: 1 })).status).toBe(404)
        for (const path of [`exercise-performances/uuid/${ids.set}`, `exercise-logs/uuid/${ids.log}`, `exercise-sessions/uuid/${ids.session}`]) {
            expect((await send(intruder.token, 'DELETE', `/api/tracker/${path}`)).status).toBe(404)
        }
        expect(await db.select().from(exercisePerformances).where(eq(exercisePerformances.uuid, ids.set))).toHaveLength(1)
    })

    it('edit and delete by uuid', async () => {
        const { u, ids, requests } = await offlineWorkout()
        await requests.session(); await requests.log(); await requests.set()

        const edited = await send(u.token, 'PATCH', `/api/tracker/exercise-performances/uuid/${ids.set}`, { reps: 8, weight: null })
        expect(await edited.json()).toMatchObject({ uuid: ids.set, reps: 8, weight: null })

        expect((await send(u.token, 'DELETE', `/api/tracker/exercise-sessions/uuid/${ids.session}`)).status).toBe(200)
        // The children go with it, and deleting again is a 404 a client can count as done.
        expect(await db.select().from(exercisePerformances).where(eq(exercisePerformances.uuid, ids.set))).toHaveLength(0)
        expect((await send(u.token, 'DELETE', `/api/tracker/exercise-sessions/uuid/${ids.session}`)).status).toBe(404)
    })

    it('need exactly one way to name the parent', async () => {
        const { u, ids, requests } = await offlineWorkout()
        await requests.session()
        const exerciseId = (await systemExercise()).id
        expect((await post(u.token, '/api/tracker/exercise-logs', { exerciseId })).status).toBe(400)
        expect((await post(u.token, '/api/tracker/exercise-logs', { exerciseSessionId: 1, exerciseSessionUuid: ids.session, exerciseId })).status).toBe(400)
    })
})
