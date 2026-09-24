import { describe, expect, it } from 'vitest'
import { app } from './helpers.js'

describe('harness', () => {
    it('serves /health', async () => {
        const res = await app.request('/health')
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ status: 'ok' })
    })
})
