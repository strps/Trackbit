import { describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import db from '../src/db/db.js'
import { invites, user } from '../src/db/schema/index.js'
import { sendEmail } from '../src/lib/email.js'
import { app, bearer, signInBearer, signedInUser } from './helpers.js'

/** Signs up the way the Android app does: JSON, no Origin header. */
function signUp(body: Record<string, unknown>, headers: Record<string, string> = {}) {
    return app.request('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ name: 'New user', password: 'password-1234', ...body }),
    })
}

async function createInvite(values: Partial<typeof invites.$inferInsert> = {}) {
    const [row] = await db.insert(invites).values({ code: 'CODE-1', role: 'tester', ...values }).returning()
    return row
}

const roleOf = async (email: string) =>
    (await db.query.user.findFirst({ where: eq(user.email, email) }))?.role

describe('sign-up', () => {
    it('stores the locale and timezone the client sends, without an invite', async () => {
        const res = await signUp({ email: 'plain@test.local', locale: 'es', timezone: 'Europe/Madrid' })
        expect(res.status).toBe(200)
        expect(res.headers.get('set-auth-token')).toBeNull()
        const row = await db.query.user.findFirst({ where: eq(user.email, 'plain@test.local') })
        expect(row).toMatchObject({ locale: 'es', timezone: 'Europe/Madrid', role: 'user', emailVerified: false })
    })

    it('a taken email is a 422', async () => {
        await signUp({ email: 'twice@test.local' })
        const res = await signUp({ email: 'twice@test.local' })
        expect(res.status).toBe(422)
        expect((await res.json()).code).toBe('USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')
    })
})

describe('invite codes', () => {
    it('a valid code (trimmed) grants its role and uses it up', async () => {
        await createInvite({ code: 'ABC123', role: 'pro', maxUses: 1 })
        expect((await signUp({ email: 'invited@test.local', inviteCode: '  ABC123 ' })).status).toBe(200)
        expect(await roleOf('invited@test.local')).toBe('pro')
        const invite = await db.query.invites.findFirst({ where: eq(invites.code, 'ABC123') })
        expect(invite?.uses).toBe(1)
        expect(invite?.consumedAt).not.toBeNull()
    })

    it('a blank code is no code', async () => {
        expect((await signUp({ email: 'blank@test.local', inviteCode: '   ' })).status).toBe(200)
        expect(await roleOf('blank@test.local')).toBe('user')
    })

    it('a multi-use code stays open until its last use', async () => {
        await createInvite({ maxUses: 2 })
        await signUp({ email: 'first@test.local', inviteCode: 'CODE-1' })
        const invite = await db.query.invites.findFirst({ where: eq(invites.code, 'CODE-1') })
        expect(invite).toMatchObject({ uses: 1, consumedAt: null })
    })

    it('refuses unknown, used-up and expired codes with stable codes and a translated message', async () => {
        await createInvite({ code: 'USED', maxUses: 1, uses: 1 })
        await createInvite({ code: 'OLD', expiresAt: new Date(Date.now() - 60_000) })
        const cases = [
            ['NOPE', 'INVITE_CODE_INVALID'],
            ['USED', 'INVITE_CODE_MAX_USES'],
            ['OLD', 'INVITE_CODE_EXPIRED'],
        ] as const
        for (const [code, expected] of cases) {
            const res = await signUp({ email: `${code.toLowerCase()}@test.local`, inviteCode: code }, { 'accept-language': 'es' })
            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.code).toBe(expected)
            expect(body.message).toMatch(/invitaci/)
            expect(await roleOf(`${code.toLowerCase()}@test.local`)).toBeUndefined()
        }
    })

    it('concurrent sign-ups never share the last use', async () => {
        await createInvite({ maxUses: 1 })
        const results = await Promise.all(
            [1, 2, 3].map((i) => signUp({ email: `race${i}@test.local`, inviteCode: 'CODE-1' })),
        )
        expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400])
        const invite = await db.query.invites.findFirst({ where: eq(invites.code, 'CODE-1') })
        expect(invite?.uses).toBe(1)
    })
})

describe('password reset', () => {
    async function requestReset(email: string) {
        vi.mocked(sendEmail).mockClear()
        const res = await app.request('/api/auth/request-password-reset', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email }),
        })
        expect(res.status).toBe(200)
        const calls = vi.mocked(sendEmail).mock.calls
        if (calls.length === 0) return null
        const url: string = (calls[0][0] as any).react.props.url
        return url
    }

    const reset = (body: unknown) => app.request('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })

    it('emails a link to the web reset page that sets the password and signs out every device', async () => {
        const u = await signedInUser()
        const url = await requestReset(u.email)
        expect(url).toMatch(/^http:\/\/localhost:5173\/reset-password\?token=/)
        const token = new URL(url!).searchParams.get('token')

        expect((await reset({ token, newPassword: 'new-password-1' })).status).toBe(200)

        const session = await app.request('/api/auth/get-session', bearer(u.token))
        expect(await session.json()).toBeNull()
        expect((await signInBearer(u.email, u.password)).res.status).toBe(401)
        expect((await signInBearer(u.email, 'new-password-1')).token).toBeTruthy()

        // A link works once.
        const again = await reset({ token, newPassword: 'new-password-2' })
        expect(again.status).toBe(400)
        expect((await again.json()).code).toBe('INVALID_TOKEN')
    })

    it('an unknown email answers the same and sends nothing', async () => {
        expect(await requestReset('nobody@test.local')).toBeNull()
    })
})

describe('verification email', () => {
    it('can be resent without a session; the answer does not tell whether the account exists', async () => {
        const send = (email: string) => app.request('/api/auth/send-verification-email', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email }),
        })
        await signUp({ email: 'pending@test.local' })
        vi.mocked(sendEmail).mockClear()
        expect((await send('pending@test.local')).status).toBe(200)
        expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1)
        vi.mocked(sendEmail).mockClear()
        expect((await send('nobody@test.local')).status).toBe(200)
        expect(vi.mocked(sendEmail)).not.toHaveBeenCalled()
    })
})
