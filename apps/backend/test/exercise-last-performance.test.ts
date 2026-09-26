import { describe, expect, it } from 'vitest'
import db from '../src/db/db.js'
import { exerciseLogs, exercisePerformances, exercises, exerciseSessions } from '../src/db/schema/index.js'
import { app, bearer, createHabit, post, signedInUser } from './helpers.js'

async function logSet(token: string, userId: string, exerciseId: number, set: { reps: number; weight: number; distance: number; duration: number }) {
    const habit = await createHabit(userId, { type: 'complex' })
    const dayLog = await (await post(token, '/api/tracker/day-logs/ensure', { habitId: habit.id })).json()
    const [session] = await db.insert(exerciseSessions).values({ dayLogId: dayLog.id }).returning()
    const [log] = await db.insert(exerciseLogs).values({ exerciseId, exerciseSessionId: session.id }).returning()
    await db.insert(exercisePerformances).values({ exerciseLogId: log.id, number: 1, rpe: 8, ...set })
}

async function lastPerformanceOf(token: string, exerciseId: number) {
    const res = await app.request('/api/exercise-info/exercises', bearer(token))
    expect(res.status).toBe(200)
    const rows: Array<{ id: number; lastPerformance: Record<string, unknown> | null }> = await res.json()
    return rows.find((r) => r.id === exerciseId)!.lastPerformance
}

describe('exercise list lastPerformance', () => {
    it('has the same JSON types as an exercise performance', async () => {
        const me = await signedInUser()
        const [exercise] = await db.insert(exercises).values({ name: `Row ${Date.now()}`, userId: me.id }).returning()
        await logSet(me.token, me.id, exercise.id, { reps: 10, weight: 22.5, distance: 1.25, duration: 90_000 })

        const last = await lastPerformanceOf(me.token, exercise.id)
        expect(last).toMatchObject({ reps: 10, weight: 22.5, distance: 1.25, duration: 90_000, rpe: 8 })
        expect(typeof last!.id).toBe('number')
        expect(last!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
    })

    it('never shows another user\'s set on a shared system exercise', async () => {
        const other = await signedInUser()
        const me = await signedInUser()
        const [system] = await db.insert(exercises).values({ name: `System ${Date.now()}`, nameI18n: { en: `System ${Date.now()}` } }).returning()
        await logSet(other.token, other.id, system.id, { reps: 5, weight: 100, distance: 0, duration: 0 })

        expect(await lastPerformanceOf(me.token, system.id)).toBeNull()
    })
})
