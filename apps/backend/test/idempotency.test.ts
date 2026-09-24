import { describe, expect, it } from 'vitest'
import { createHabit, dayLogsFor, post, signedInUser } from './helpers.js'

const increment = (token: string, habitId: number, key?: string) =>
    post(token, '/api/tracker/check/increment', { habitId, delta: 1, day: '2026-01-10' },
        key ? { 'idempotency-key': key } : {})

describe('Idempotency-Key', () => {
    it('replays the first response instead of re-running the write', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)

        const first = await increment(u.token, habit.id, 'key-1')
        const retry = await increment(u.token, habit.id, 'key-1')

        expect(retry.status).toBe(200)
        expect(retry.headers.get('idempotent-replayed')).toBe('true')
        expect(await retry.json()).toEqual(await first.json())
        expect((await dayLogsFor(habit.id))[0].rating).toBe(1)
    })

    it('runs again for a different key', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)
        await increment(u.token, habit.id, 'key-1')
        await increment(u.token, habit.id, 'key-2')
        expect((await dayLogsFor(habit.id))[0].rating).toBe(2)
    })

    it('scopes keys per user', async () => {
        const a = await signedInUser()
        const b = await signedInUser()
        const habitA = await createHabit(a.id)
        const habitB = await createHabit(b.id)

        await increment(a.token, habitA.id, 'shared')
        const res = await increment(b.token, habitB.id, 'shared')
        expect(res.headers.get('idempotent-replayed')).toBeNull()
        expect((await dayLogsFor(habitB.id))[0].rating).toBe(1)
    })

    it('releases the key when the request fails', async () => {
        const u = await signedInUser()
        const frozen = await createHabit(u.id, { type: 'timed' })
        const habit = await createHabit(u.id)

        expect((await post(u.token, '/api/tracker/check/increment', { habitId: frozen.id, delta: 1 }, { 'idempotency-key': 'k' })).status).toBe(403)
        const res = await increment(u.token, habit.id, 'k')
        expect(res.status).toBe(200)
        expect(res.headers.get('idempotent-replayed')).toBeNull()
    })

    it('rejects reusing a key on a different route', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)
        await increment(u.token, habit.id, 'k')
        const res = await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 1 }, { 'idempotency-key': 'k' })
        expect(res.status).toBe(422)
    })
})
