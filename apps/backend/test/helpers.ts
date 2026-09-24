import { eq } from 'drizzle-orm'
import { app } from '../src/index.js'
import { auth } from '../src/lib/auth.js'
import db from '../src/db/db.js'
import { user } from '../src/db/schema/index.js'

export { app }

let counter = 0

export async function createVerifiedUser(overrides: { email?: string; password?: string; timezone?: string } = {}) {
    const email = overrides.email ?? `user${++counter}@test.local`
    const password = overrides.password ?? 'password-1234'
    const { user: created } = await auth.api.signUpEmail({
        body: { email, password, name: email.split('@')[0] },
    })
    await db
        .update(user)
        .set({
            emailVerified: true,
            ...(overrides.timezone && { timezone: overrides.timezone }),
        })
        .where(eq(user.id, created.id))
    return { id: created.id, email, password }
}

/** Signs in the way a native client does: no Origin header, token read from `set-auth-token`. */
export async function signInBearer(email: string, password: string) {
    const res = await app.request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
    })
    const token = res.headers.get('set-auth-token')
    return { res, token }
}

export function bearer(token: string, init: RequestInit = {}): RequestInit {
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${token}`)
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
    return { ...init, headers }
}

export async function signedInUser(overrides: Parameters<typeof createVerifiedUser>[0] = {}) {
    const u = await createVerifiedUser(overrides)
    const { token } = await signInBearer(u.email, u.password)
    if (!token) throw new Error('sign-in did not return set-auth-token')
    return { ...u, token }
}

import { habits, dayLogs } from '../src/db/schema/index.js'

let habitOrder = 0

export async function createHabit(
    userId: string,
    values: Partial<typeof habits.$inferInsert> = {},
) {
    const [row] = await db
        .insert(habits)
        .values({ userId, name: 'Habit', type: 'count', order: ++habitOrder, ...values })
        .returning()
    return row
}

export async function dayLogsFor(habitId: number) {
    return db.select().from(dayLogs).where(eq(dayLogs.habitId, habitId))
}

export function post(token: string, path: string, body: unknown, headers: Record<string, string> = {}) {
    return app.request(path, bearer(token, { method: 'POST', body: JSON.stringify(body), headers }))
}
