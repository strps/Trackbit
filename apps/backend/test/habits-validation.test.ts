import { describe, expect, it } from 'vitest'
import { app, bearer, createHabit, signedInUser } from './helpers.js'

describe('habit icon ids', () => {
    it('accepts a canonical icon id and rejects anything else', async () => {
        const { token } = await signedInUser()
        const create = (icon: string) => app.request('/api/habits', bearer(token, {
            method: 'POST',
            body: JSON.stringify({ name: 'Walk', icon }),
        }))

        expect((await create('trees')).status).toBe(201)
        expect((await create('Activity')).status).toBe(400)
    })
})

describe('habit daily goal', () => {
    it('must be a whole number of at least 1', async () => {
        const { token } = await signedInUser()
        const create = (dailyGoal: number) => app.request('/api/habits', bearer(token, {
            method: 'POST',
            body: JSON.stringify({ name: 'Read', dailyGoal }),
        }))

        expect((await create(1)).status).toBe(201)
        expect((await create(0)).status).toBe(400)
        expect((await create(1.5)).status).toBe(400)
    })

    it('is left alone by an update that omits it', async () => {
        const { token } = await signedInUser()
        const created = await app.request('/api/habits', bearer(token, {
            method: 'POST',
            body: JSON.stringify({ name: 'Read', dailyGoal: 3, weeklyGoal: 4 }),
        }))
        const { id } = await created.json()

        const updated = await app.request(`/api/habits/${id}`, bearer(token, {
            method: 'PUT',
            body: JSON.stringify({ name: 'Read more' }),
        }))
        expect(updated.status).toBe(200)
        expect(await updated.json()).toMatchObject({ name: 'Read more', dailyGoal: 3, weeklyGoal: 4 })
    })
})

describe('habit name', () => {
    it('is trimmed and must be 3 to 50 characters', async () => {
        const { token } = await signedInUser()
        const create = (name: string) => app.request('/api/habits', bearer(token, {
            method: 'POST',
            body: JSON.stringify({ name }),
        }))

        const ok = await create('  Run  ')
        expect(ok.status).toBe(201)
        expect((await ok.json()).name).toBe('Run')
        expect((await create('  Go ')).status).toBe(400)
        expect((await create('x'.repeat(51))).status).toBe(400)
    })
})

describe('anti-habits', () => {
    async function create(token: string, body: object) {
        const res = await app.request('/api/habits', bearer(token, { method: 'POST', body: JSON.stringify(body) }))
        return { status: res.status, habit: await res.json() }
    }

    it('cannot be structured sessions, on create, update or reorder', async () => {
        const { token } = await signedInUser()
        expect((await create(token, { name: 'Gym', type: 'complex', isAntiHabit: true })).status).toBe(400)

        const { habit: gym } = await create(token, { name: 'Gym', type: 'complex' })
        const toAnti = await app.request(`/api/habits/${gym.id}`, bearer(token, {
            method: 'PUT',
            body: JSON.stringify({ isAntiHabit: true }),
        }))
        expect(toAnti.status).toBe(400)
        expect(await toAnti.json()).toMatchObject({ error: 'anti_habit_not_allowed' })

        const { habit: smoke } = await create(token, { name: 'Smoke', isAntiHabit: true })
        const toComplex = await app.request(`/api/habits/${smoke.id}`, bearer(token, {
            method: 'PUT',
            body: JSON.stringify({ type: 'complex' }),
        }))
        expect(toComplex.status).toBe(400)

        const reorder = await app.request('/api/habits/reorder', bearer(token, {
            method: 'PATCH',
            body: JSON.stringify({ items: [{ id: gym.id, order: 0, isAntiHabit: true }] }),
        }))
        expect(reorder.status).toBe(400)
    })

    it('moving a habit to the other group takes that group\'s next slot', async () => {
        const { token } = await signedInUser()
        const { habit: read } = await create(token, { name: 'Read' })
        const { habit: smoke } = await create(token, { name: 'Smoke', isAntiHabit: true })
        expect(read.order).toBe(0)
        expect(smoke.order).toBe(0)

        const moved = await app.request(`/api/habits/${read.id}`, bearer(token, {
            method: 'PUT',
            body: JSON.stringify({ isAntiHabit: true }),
        }))
        expect(moved.status).toBe(200)
        expect(await moved.json()).toMatchObject({ isAntiHabit: true, order: 1 })
    })

    it('an update can\'t change the habit\'s id', async () => {
        const { token } = await signedInUser()
        const { habit } = await create(token, { name: 'Read' })
        const res = await app.request(`/api/habits/${habit.id}`, bearer(token, {
            method: 'PUT',
            body: JSON.stringify({ id: habit.id + 1000, name: 'Read more' }),
        }))
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ id: habit.id, name: 'Read more' })
    })
})

describe('reordering with a frozen habit', () => {
    it('moves frozen habits within their group but not to the other one', async () => {
        const u = await signedInUser()
        const create = async (body: object) =>
            (await app.request('/api/habits', bearer(u.token, { method: 'POST', body: JSON.stringify(body) }))).json()
        const read = await create({ name: 'Read' })
        // The default role can't have timed habits, so this one is frozen.
        const meditate = await createHabit(u.id, { name: 'Meditate', type: 'timed', order: 1 })
        const reorder = (items: object[]) => app.request('/api/habits/reorder', bearer(u.token, {
            method: 'PATCH',
            body: JSON.stringify({ items }),
        }))

        const swapped = await reorder([
            { id: meditate.id, order: 0, isAntiHabit: false },
            { id: read.id, order: 1, isAntiHabit: false },
        ])
        expect(swapped.status).toBe(200)

        const toAnti = await reorder([{ id: meditate.id, order: 0, isAntiHabit: true }])
        expect(toAnti.status).toBe(403)
        expect(await toAnti.json()).toMatchObject({ error: 'habit_frozen', frozenIds: [meditate.id] })
    })
})
