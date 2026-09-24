import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { app, bearer, createHabit, dayLogsFor, post, signedInUser } from './helpers.js'

describe('POST /api/tracker/check', () => {
    it('upserts one row per (habit, day)', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)

        const first = await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 2, day: '2026-01-10' })
        expect(first.status).toBe(200)
        const second = await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 5, day: '2026-01-10' })
        const row = await second.json()

        expect(row).toMatchObject({ habitId: habit.id, localDay: '2026-01-10', rating: 5 })
        expect(await dayLogsFor(habit.id)).toHaveLength(1)
    })

    it("rejects another user's habit with 404", async () => {
        const owner = await signedInUser()
        const intruder = await signedInUser()
        const habit = await createHabit(owner.id)

        const res = await post(intruder.token, '/api/tracker/check', { habitId: habit.id, rating: 1 })
        expect(res.status).toBe(404)
        expect(await dayLogsFor(habit.id)).toHaveLength(0)
    })

    it('rejects a frozen habit with habit_frozen', async () => {
        const u = await signedInUser()
        // 'timed' is not in the default role's allowedHabitTypes, so it is frozen.
        const habit = await createHabit(u.id, { type: 'timed' })

        const res = await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 1 })
        expect(res.status).toBe(403)
        expect(await res.json()).toMatchObject({ error: 'habit_frozen', habitId: habit.id })
    })

    it("defaults day to today in the user's stored timezone", async () => {
        const u = await signedInUser({ timezone: 'Pacific/Kiritimati' })
        const habit = await createHabit(u.id)

        const row = await (await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 1 })).json()
        expect(row.localDay).toBe(DateTime.now().setZone('Pacific/Kiritimati').toISODate())
    })

    it('rejects an impossible day', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)
        const res = await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 1, day: '2026-02-30' })
        expect(res.status).toBe(400)
    })
})

describe('POST /api/tracker/check/increment', () => {
    it('is atomic under concurrency', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)

        await Promise.all(
            Array.from({ length: 20 }, () =>
                post(u.token, '/api/tracker/check/increment', { habitId: habit.id, delta: 1, day: '2026-01-10' })),
        )

        const rows = await dayLogsFor(habit.id)
        expect(rows).toHaveLength(1)
        expect(rows[0].rating).toBe(20)
    })

    it('composes with /check', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)

        await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 3, day: '2026-01-10' })
        const row = await (await post(u.token, '/api/tracker/check/increment', { habitId: habit.id, delta: -1, day: '2026-01-10' })).json()
        expect(row.rating).toBe(2)
    })

    it('rejects delta 0 and foreign habits', async () => {
        const owner = await signedInUser()
        const intruder = await signedInUser()
        const habit = await createHabit(owner.id)

        expect((await post(owner.token, '/api/tracker/check/increment', { habitId: habit.id, delta: 0 })).status).toBe(400)
        expect((await post(intruder.token, '/api/tracker/check/increment', { habitId: habit.id, delta: 1 })).status).toBe(404)
    })
})

describe('POST /api/tracker/day-logs/ensure', () => {
    it('creates once and returns the same row afterwards', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { type: 'complex' })

        const a = await (await post(u.token, '/api/tracker/day-logs/ensure', { habitId: habit.id, day: '2026-01-05' })).json()
        const b = await (await post(u.token, '/api/tracker/day-logs/ensure', { habitId: habit.id, day: '2026-01-05' })).json()

        expect(a.id).toBe(b.id)
        expect(a).toMatchObject({ localDay: '2026-01-05', rating: null })
        expect(await dayLogsFor(habit.id)).toHaveLength(1)
    })

    it('no longer exposes the raw CRUD create', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)
        const res = await post(u.token, '/api/tracker/day-logs', { habitId: habit.id })
        expect(res.status).toBe(404)
    })
})

describe('GET /api/tracker/history', () => {
    it('filters by start/end on the stored local day', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)
        for (const day of ['2026-01-01', '2026-01-02', '2026-01-03']) {
            await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 1, day })
        }

        const res = await app.request('/api/tracker/history?start=2026-01-02&end=2026-01-03', bearer(u.token))
        const [h] = await res.json()
        expect(h.dayLogs.map((l: any) => l.localDay)).toEqual(['2026-01-03', '2026-01-02'])
    })
})
