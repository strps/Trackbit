import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import db from '../src/db/db.js'
import { exerciseMuscleGroups, exercises, muscleGroups, user } from '../src/db/schema/index.js'
import { app, bearer, createHabit, post, signedInUser } from './helpers.js'

const get = (token: string, path: string) => app.request(path, bearer(token))

async function systemExercise(name = `Exercise ${Math.random()}`) {
    const [row] = await db.insert(exercises).values({ name, category: 'strength' }).returning()
    return row
}

async function addSession(token: string, habitId: number, day: string, exerciseId: number, sets: object[]) {
    const session = await (await post(token, '/api/tracker/exercise-sessions', { habitId, day })).json()
    const log = await (await post(token, '/api/tracker/exercise-logs', { exerciseSessionId: session.id, exerciseId })).json()
    for (const [i, set] of sets.entries()) {
        await post(token, '/api/tracker/exercise-performances', { exerciseLogId: log.id, number: i + 1, ...set })
    }
}

describe('GET /api/tracker/sets', () => {
    it("returns every set of the habit, flat and oldest day first", async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { type: 'complex' })
        const other = await createHabit(u.id, { type: 'complex' })
        const bench = await systemExercise()
        const squat = await systemExercise()
        await addSession(u.token, habit.id, '2026-01-12', squat.id, [{ reps: 5, weight: 100, rpe: 9 }])
        await addSession(u.token, habit.id, '2026-01-10', bench.id, [{ reps: 8, weight: 60 }, { reps: 6, weight: 62.5, rpe: 8 }])
        await addSession(u.token, other.id, '2026-01-11', bench.id, [{ reps: 1, weight: 1 }])

        const res = await get(u.token, `/api/tracker/sets?habitId=${habit.id}`)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            habitId: habit.id,
            sets: [
                { day: '2026-01-10', exerciseId: bench.id, weight: 60, reps: 8, rpe: null, duration: null, distance: null },
                { day: '2026-01-10', exerciseId: bench.id, weight: 62.5, reps: 6, rpe: 8, duration: null, distance: null },
                { day: '2026-01-12', exerciseId: squat.id, weight: 100, reps: 5, rpe: 9, duration: null, distance: null },
            ],
        })
    })

    it("answers 404 for another user's habit", async () => {
        const owner = await signedInUser()
        const habit = await createHabit(owner.id, { type: 'complex' })
        const intruder = await signedInUser()
        expect((await get(intruder.token, `/api/tracker/sets?habitId=${habit.id}`)).status).toBe(404)
    })
})

describe('GET /api/exercise-info/exercises', () => {
    it("names each exercise's muscle groups in the user's locale", async () => {
        const u = await signedInUser()
        await db.update(user).set({ locale: 'es' }).where(eq(user.id, u.id))
        const bench = await systemExercise()
        const [chest] = await db.insert(muscleGroups).values({ name: 'Chest', nameI18n: { en: 'Chest', es: 'Pecho' }, slug: `chest-${Math.random()}` }).returning()
        const [triceps] = await db.insert(muscleGroups).values({ name: 'Triceps', slug: `triceps-${Math.random()}` }).returning()
        await db.insert(exerciseMuscleGroups).values([
            { exerciseId: bench.id, muscleGroupId: chest.id },
            { exerciseId: bench.id, muscleGroupId: triceps.id },
        ])
        const bare = await systemExercise()

        const list = await (await get(u.token, '/api/exercise-info/exercises')).json()
        const byId = new Map(list.map((e: { id: number }) => [e.id, e]))
        expect((byId.get(bench.id) as any).muscleGroups).toEqual([
            { id: chest.id, name: 'Pecho' },
            { id: triceps.id, name: 'Triceps' },
        ])
        expect((byId.get(bare.id) as any).muscleGroups).toEqual([])
    })
})
