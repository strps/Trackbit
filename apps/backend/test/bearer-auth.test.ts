import { describe, expect, it } from 'vitest'
import { app, bearer, createVerifiedUser, signInBearer, signedInUser } from './helpers.js'

// A8: native clients send no Origin header and authenticate with a bearer token.
describe('bearer auth (native clients)', () => {
    it('signs in without an Origin header and returns set-auth-token', async () => {
        const u = await createVerifiedUser()
        const { res, token } = await signInBearer(u.email, u.password)
        expect(res.status).toBe(200)
        expect(token).toBeTruthy()
    })

    it('authenticates get-session and API routes with the bearer token', async () => {
        const { token, email } = await signedInUser()

        const session = await app.request('/api/auth/get-session', bearer(token))
        expect(session.status).toBe(200)
        expect((await session.json()).user.email).toBe(email)

        const history = await app.request('/api/tracker/history', bearer(token))
        expect(history.status).toBe(200)
    })

    it('rejects a tampered token', async () => {
        const { token } = await signedInUser()
        const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa')
        const res = await app.request('/api/tracker/history', bearer(tampered))
        expect(res.status).toBe(401)
    })

    it('signs out with the bearer token and no Origin header', async () => {
        const { token } = await signedInUser()
        const out = await app.request('/api/auth/sign-out', bearer(token, { method: 'POST' }))
        expect(out.status).toBe(200)

        const after = await app.request('/api/tracker/history', bearer(token))
        expect(after.status).toBe(401)
    })
})
