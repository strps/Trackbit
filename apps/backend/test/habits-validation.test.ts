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
