import { describe, expect, it } from 'vitest'
import { app, bearer, signedInUser } from './helpers.js'

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
