import { describe, expect, it } from 'vitest'
import { GRADIENT_PRESET_STOPS } from '@trackbit/types'
import { app, bearer, createHabit, post, signedInUser } from './helpers.js'
import db from '../src/db/db.js'
import { exerciseSessions } from '../src/db/schema/index.js'

const today = async (token: string, day: string) =>
    (await app.request(`/api/tracker/today?day=${day}`, bearer(token))).json()

describe('GET /api/tracker/today', () => {
    it('returns per-habit state for the day with streak up to the day before', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { name: 'Read', dailyGoal: 3, colorTheme: 'blue' })
        for (const day of ['2026-01-07', '2026-01-08', '2026-01-09']) {
            await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 1, day })
        }
        await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 2, day: '2026-01-10' })

        const body = await today(u.token, '2026-01-10')
        expect(body.day).toBe('2026-01-10')
        expect(body.habits).toHaveLength(1)
        const h = body.habits[0]
        expect(h).toMatchObject({
            id: habit.id, name: 'Read', type: 'count', dailyGoal: 3, frozen: false,
            firstLogDay: '2026-01-07', streakBeforeDay: 3,
            colorStops: GRADIENT_PRESET_STOPS.blue,
        })
        expect(h.recent.map((r: any) => r.day)).toEqual(
            ['2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10'])
        expect(h.recent.map((r: any) => r.rating)).toEqual([null, null, null, 1, 1, 1, 2])
    })

    it('counts sessions for complex habits', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id, { type: 'complex' })
        const log = await (await post(u.token, '/api/tracker/day-logs/ensure', { habitId: habit.id, day: '2026-01-09' })).json()
        await db.insert(exerciseSessions).values([{ dayLogId: log.id }, { dayLogId: log.id }])

        const h = (await today(u.token, '2026-01-10')).habits[0]
        expect(h.recent.at(-2)).toEqual({ day: '2026-01-09', rating: null, sessionCount: 2 })
        expect(h.streakBeforeDay).toBe(1)
    })

    it('flags frozen habits and excludes other users', async () => {
        const u = await signedInUser()
        const other = await signedInUser()
        await createHabit(u.id, { type: 'timed' })
        await createHabit(other.id)

        const body = await today(u.token, '2026-01-10')
        expect(body.habits).toHaveLength(1)
        expect(body.habits[0].frozen).toBe(true)
    })

    it('defaults to the user\'s today', async () => {
        const u = await signedInUser({ timezone: 'Asia/Tokyo' })
        const res = await app.request('/api/tracker/today', bearer(u.token))
        const { day } = await res.json()
        expect(day).toBe(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date()))
    })
})
