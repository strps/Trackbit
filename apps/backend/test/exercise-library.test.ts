import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import db from '../src/db/db.js'
import { exerciseLogs, exerciseMuscleGroups, exercisePerformances, exercises, exerciseSessions, muscleGroups, user } from '../src/db/schema/index.js'
import { app, bearer, createHabit, post, signedInUser } from './helpers.js'

const get = (token: string, path: string) => app.request(path, bearer(token))
const send = (token: string, method: string, path: string, body?: unknown) =>
    app.request(path, bearer(token, { method, ...(body !== undefined && { body: JSON.stringify(body) }) }))

const EXERCISES = '/api/exercise-info/exercises'

async function muscleGroup(name: string) {
    const [row] = await db.insert(muscleGroups)
        .values({ name, nameI18n: { en: name, es: `${name} (es)` }, slug: `${name.toLowerCase()}-${Math.random()}` })
        .returning()
    return row
}

async function linkedGroups(exerciseId: number) {
    const rows = await db.select().from(exerciseMuscleGroups).where(eq(exerciseMuscleGroups.exerciseId, exerciseId))
    return rows.map((r) => r.muscleGroupId).sort((a, b) => a - b)
}

describe('custom exercise create', () => {
    it('stores its muscle groups and answers with the list shape', async () => {
        const { token } = await signedInUser()
        const chest = await muscleGroup('Chest')
        const triceps = await muscleGroup('Triceps')

        const res = await post(token, EXERCISES, {
            name: '  Dips  ', description: '  Lean forward  ', category: 'strength', muscleGroups: [triceps.id, chest.id, chest.id],
        })
        expect(res.status).toBe(201)
        const created = await res.json()
        expect(created).toMatchObject({ name: 'Dips', description: 'Lean forward', category: 'strength', frozen: false, lastPerformance: null })
        expect(created.muscleGroups.map((g: { id: number }) => g.id).sort()).toEqual([chest.id, triceps.id].sort())
        expect(await linkedGroups(created.id)).toEqual([chest.id, triceps.id].sort((a, b) => a - b))

        const listed = (await (await get(token, EXERCISES)).json()).find((e: { id: number }) => e.id === created.id)
        expect(listed).toEqual(created)
    })

    it("names its muscle groups in the user's language", async () => {
        const { id: userId, token } = await signedInUser()
        await db.update(user).set({ locale: 'es' }).where(eq(user.id, userId))
        const back = await muscleGroup('Back')
        const res = await post(token, EXERCISES, { name: 'Row', category: 'strength', muscleGroups: [back.id] })
        expect((await res.json()).muscleGroups).toEqual([{ id: back.id, name: 'Back (es)' }])
    })

    it('defaults to no muscle groups and stores a blank description as null', async () => {
        const { token } = await signedInUser()
        const res = await post(token, EXERCISES, { name: 'Plank', category: 'flexibility', description: '   ' })
        expect(res.status).toBe(201)
        expect(await res.json()).toMatchObject({ description: null, muscleGroups: [] })
    })

    it('refuses a muscle group that does not exist, and stores nothing', async () => {
        const { id: userId, token } = await signedInUser()
        const res = await post(token, EXERCISES, { name: 'Ghost', category: 'strength', muscleGroups: [999_999] })
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('muscle_group_not_found')
        expect(await db.select().from(exercises).where(eq(exercises.userId, userId))).toHaveLength(0)
    })

    it('validates name, category, units and unknown fields', async () => {
        const { token } = await signedInUser()
        const create = (body: object) => post(token, EXERCISES, { name: 'Squat', category: 'strength', ...body })

        expect((await create({ name: '   ' })).status).toBe(400)
        expect((await create({ name: 'x'.repeat(101) })).status).toBe(400)
        expect((await create({ category: 'yoga' })).status).toBe(400)
        expect((await create({ defaultWeightUnit: 'stone' })).status).toBe(400)
        expect((await create({ description: 'x'.repeat(501) })).status).toBe(400)
        expect((await create({ userId: 'someone' })).status).toBe(400)
        expect((await create({ name: 'x'.repeat(100), defaultWeightUnit: 'lbs', defaultDistanceUnit: 'miles' })).status).toBe(201)
    })

    it('answers 409 exercise_name_taken for a name the user already has', async () => {
        const { token } = await signedInUser()
        expect((await post(token, EXERCISES, { name: 'Curl', category: 'strength' })).status).toBe(201)
        const res = await post(token, EXERCISES, { name: ' Curl ', category: 'cardio' })
        expect(res.status).toBe(409)
        expect((await res.json()).error).toBe('exercise_name_taken')

        // Another user may use it.
        const other = await signedInUser()
        expect((await post(other.token, EXERCISES, { name: 'Curl', category: 'strength' })).status).toBe(201)
    })
})

describe('custom exercise update', () => {
    it('replaces the muscle groups when sent, and keeps them when not', async () => {
        const { token } = await signedInUser()
        const chest = await muscleGroup('Chest')
        const legs = await muscleGroup('Legs')
        const { id } = await (await post(token, EXERCISES, { name: 'Press', category: 'strength', muscleGroups: [chest.id] })).json()

        await send(token, 'PATCH', `${EXERCISES}/${id}`, { description: 'Flat bench' })
        const renamed = await send(token, 'PATCH', `${EXERCISES}/${id}`, { name: 'Bench' })
        expect(renamed.status).toBe(200)
        expect(await renamed.json()).toMatchObject({ name: 'Bench', description: 'Flat bench', muscleGroups: [{ id: chest.id, name: 'Chest' }] })

        const moved = await send(token, 'PATCH', `${EXERCISES}/${id}`, { muscleGroups: [legs.id] })
        expect((await moved.json()).muscleGroups).toEqual([{ id: legs.id, name: 'Legs' }])
        expect(await linkedGroups(id)).toEqual([legs.id])

        await send(token, 'PATCH', `${EXERCISES}/${id}`, { muscleGroups: [] })
        expect(await linkedGroups(id)).toEqual([])
    })

    it('rolls back when a muscle group does not exist', async () => {
        const { token } = await signedInUser()
        const chest = await muscleGroup('Chest')
        const { id } = await (await post(token, EXERCISES, { name: 'Fly', category: 'strength', muscleGroups: [chest.id] })).json()

        const res = await send(token, 'PATCH', `${EXERCISES}/${id}`, { name: 'Cable fly', muscleGroups: [999_999] })
        expect(res.status).toBe(400)
        const [row] = await db.select().from(exercises).where(eq(exercises.id, id))
        expect(row.name).toBe('Fly')
        expect(await linkedGroups(id)).toEqual([chest.id])
    })

    it('answers 409 when renamed to a name the user already has', async () => {
        const { token } = await signedInUser()
        await post(token, EXERCISES, { name: 'Lunge', category: 'strength' })
        const { id } = await (await post(token, EXERCISES, { name: 'Step-up', category: 'strength' })).json()
        const res = await send(token, 'PATCH', `${EXERCISES}/${id}`, { name: 'Lunge' })
        expect(res.status).toBe(409)
        expect((await res.json()).error).toBe('exercise_name_taken')
    })

    it("refuses a system exercise or another user's with 404, and an empty body with 400", async () => {
        const { token } = await signedInUser()
        const [system] = await db.insert(exercises).values({ name: `System ${Math.random()}` }).returning()
        const other = await signedInUser()
        const { id: theirs } = await (await post(other.token, EXERCISES, { name: 'Theirs', category: 'strength' })).json()
        const { id: mine } = await (await post(token, EXERCISES, { name: 'Mine', category: 'strength' })).json()

        expect((await send(token, 'PATCH', `${EXERCISES}/${system.id}`, { name: 'Hacked' })).status).toBe(404)
        expect((await send(token, 'PATCH', `${EXERCISES}/${theirs}`, { name: 'Hacked' })).status).toBe(404)
        expect((await send(token, 'DELETE', `${EXERCISES}/${system.id}`)).status).toBe(404)
        expect((await send(token, 'DELETE', `${EXERCISES}/${theirs}`)).status).toBe(404)
        expect((await send(token, 'PATCH', `${EXERCISES}/${mine}`, {})).status).toBe(400)
    })

    it('refuses a frozen exercise with 403, which can still be deleted', async () => {
        const { id: userId, token } = await signedInUser()
        // One over the default role's cap of 5: the newest is frozen.
        const rows = await db.insert(exercises)
            .values(Array.from({ length: 6 }, (_, i) => ({ name: `Custom ${i}`, userId, createdAt: new Date(2026, 0, i + 1) })))
            .returning()
        const frozen = (await (await get(token, EXERCISES)).json()).find((e: { frozen: boolean }) => e.frozen)
        expect(frozen.id).toBe(rows[5].id)

        const res = await send(token, 'PATCH', `${EXERCISES}/${frozen.id}`, { name: 'Thawed' })
        expect(res.status).toBe(403)
        expect(await res.json()).toMatchObject({ error: 'custom_exercise_frozen', exerciseId: frozen.id })
        expect((await send(token, 'DELETE', `${EXERCISES}/${frozen.id}`)).status).toBe(200)
    })
})

describe('custom exercise delete', () => {
    it('deletes its logs and their sets, and keeps the session and other logs', async () => {
        const { id: userId, token } = await signedInUser()
        const habit = await createHabit(userId, { type: 'complex' })
        const [system] = await db.insert(exercises).values({ name: `System ${Math.random()}` }).returning()
        const { id } = await (await post(token, EXERCISES, { name: 'Mine', category: 'strength' })).json()
        const session = await (await post(token, '/api/tracker/exercise-sessions', { habitId: habit.id, day: '2026-01-10' })).json()
        const mineLog = await (await post(token, '/api/tracker/exercise-logs', { exerciseSessionId: session.id, exerciseId: id })).json()
        const keptLog = await (await post(token, '/api/tracker/exercise-logs', { exerciseSessionId: session.id, exerciseId: system.id })).json()
        await post(token, '/api/tracker/exercise-performances', { exerciseLogId: mineLog.id, number: 1, reps: 5 })
        await post(token, '/api/tracker/exercise-performances', { exerciseLogId: keptLog.id, number: 1, reps: 8 })

        const res = await send(token, 'DELETE', `${EXERCISES}/${id}`)
        expect(res.status).toBe(200)
        expect(await db.select().from(exercises).where(eq(exercises.id, id))).toHaveLength(0)
        expect(await db.select().from(exerciseSessions).where(eq(exerciseSessions.id, session.id))).toHaveLength(1)
        const logs = await db.select().from(exerciseLogs).where(eq(exerciseLogs.exerciseSessionId, session.id))
        expect(logs.map((l) => l.id)).toEqual([keptLog.id])
        expect(await db.select().from(exercisePerformances).where(eq(exercisePerformances.exerciseLogId, mineLog.id))).toHaveLength(0)
        expect(await db.select().from(exercisePerformances).where(eq(exercisePerformances.exerciseLogId, keptLog.id))).toHaveLength(1)
    })
})

describe('muscle groups', () => {
    it('are listed for users but only admins can change them', async () => {
        const { token } = await signedInUser()
        const chest = await muscleGroup('Chest')

        const list = await get(token, '/api/exercise-info/muscle-groups')
        expect(list.status).toBe(200)
        expect((await list.json()).some((g: { id: number }) => g.id === chest.id)).toBe(true)

        await post(token, '/api/exercise-info/muscle-groups', { name: 'Mine', slug: `mine-${Math.random()}` })
        await send(token, 'PATCH', `/api/exercise-info/muscle-groups/${chest.id}`, { name: 'Hacked' })
        await send(token, 'DELETE', `/api/exercise-info/muscle-groups/${chest.id}`)
        const [row] = await db.select().from(muscleGroups).where(eq(muscleGroups.id, chest.id))
        expect(row.name).toBe('Chest')
        expect(await db.select().from(muscleGroups).where(eq(muscleGroups.name, 'Mine'))).toHaveLength(0)
    })
})

describe('exercise descriptions', () => {
    it('are never blank: admin translations drop blanks, and the database refuses one', async () => {
        const { id: adminId, token } = await signedInUser()
        await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId))

        const res = await post(token, '/admin/exercises', {
            name: { en: `Squat ${Math.random()}` }, category: 'strength', description: { en: '  Deep  ', es: '   ' },
        })
        expect(res.status).toBe(201)
        const { id } = await res.json()
        const stored = async () => (await db.select().from(exercises).where(eq(exercises.id, id)))[0].descriptionI18n
        expect(await stored()).toEqual({ en: 'Deep' })

        expect((await send(token, 'PATCH', `/admin/exercises/${id}`, { description: { en: ' ' } })).status).toBe(200)
        expect(await stored()).toBeNull()

        await expect(db.insert(exercises).values({ name: `Blank ${Math.random()}`, description: '  ' })).rejects.toThrow()
    })
})
