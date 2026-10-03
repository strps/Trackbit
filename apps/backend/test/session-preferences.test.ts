import { describe, expect, it } from 'vitest'
import { app, bearer, signedInUser } from './helpers.js'

describe('session user preferences', () => {
    it('get-session carries every preference field', async () => {
        const { token } = await signedInUser()
        const res = await app.request('/api/auth/get-session', bearer(token))
        const { user } = await res.json()
        expect(user).toMatchObject({
            locale: 'en',
            timezone: 'UTC',
            unitSystem: 'metric',
            exerciseLogCardStyle: 'classic',
            defaultRestSeconds: 90,
        })
        expect(user).toHaveProperty('preferredExerciseSource')
    })
})

describe('defaultRestSeconds', () => {
    it('PATCH /api/me/preferences sets it within 0–3600 and the session carries it', async () => {
        const { token } = await signedInUser()
        const patch = (value: unknown) =>
            app.request('/api/me/preferences', bearer(token, { method: 'PATCH', body: JSON.stringify({ defaultRestSeconds: value }) }))
        for (const bad of [-1, 3601, 1.5, null, '90']) expect((await patch(bad)).status).toBe(400)
        expect((await patch(0)).status).toBe(204)
        expect((await patch(150)).status).toBe(204)
        const { user } = await (await app.request('/api/auth/get-session', bearer(token))).json()
        expect(user.defaultRestSeconds).toBe(150)
    })
})

describe('timezone is validated at every write boundary', () => {
    it('PATCH /api/me/preferences rejects a non-IANA timezone', async () => {
        const { token } = await signedInUser()
        const bad = await app.request('/api/me/preferences', bearer(token, { method: 'PATCH', body: JSON.stringify({ timezone: 'Mars/Olympus' }) }))
        expect(bad.status).toBe(400)
        const ok = await app.request('/api/me/preferences', bearer(token, { method: 'PATCH', body: JSON.stringify({ timezone: 'Europe/Madrid' }) }))
        expect(ok.status).toBe(204)
    })

    it('sign-up rejects a non-IANA timezone', async () => {
        const res = await app.request('/api/auth/sign-up/email', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: 'tz@test.local', password: 'password-1234', name: 'tz', timezone: 'nope' }),
        })
        expect(res.status).toBe(400)
    })

    it('update-user rejects a non-IANA timezone', async () => {
        const { token } = await signedInUser()
        const res = await app.request('/api/auth/update-user', bearer(token, { method: 'POST', body: JSON.stringify({ timezone: 'nope' }) }))
        expect(res.status).toBe(400)
    })
})

describe('locale is validated at every write boundary', () => {
    it('update-user and sign-up reject a locale the apps do not ship', async () => {
        const { token } = await signedInUser()
        const update = (locale: string) =>
            app.request('/api/auth/update-user', bearer(token, { method: 'POST', body: JSON.stringify({ locale }) }))
        expect((await update('fr')).status).toBe(400)
        expect((await update('es')).status).toBe(200)

        const signUp = await app.request('/api/auth/sign-up/email', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: 'fr@test.local', password: 'password-1234', name: 'fr', locale: 'fr' }),
        })
        expect(signUp.status).toBe(400)
    })
})

describe('profile name', () => {
    it('update-user stores it trimmed and rejects a blank or overlong one', async () => {
        const { token } = await signedInUser()
        const update = (name: string) =>
            app.request('/api/auth/update-user', bearer(token, { method: 'POST', body: JSON.stringify({ name }) }))
        expect((await update('   ')).status).toBe(400)
        expect((await update('x'.repeat(101))).status).toBe(400)
        expect((await update('  Ada Lovelace ')).status).toBe(200)
        const { user } = await (await app.request('/api/auth/get-session', bearer(token))).json()
        expect(user.name).toBe('Ada Lovelace')
    })
})
