import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import db from '../src/db/db.js'
import { issues } from '../src/db/schema/index.js'
import { app, post, signedInUser } from './helpers.js'

const ISSUES = '/api/issues'

describe('POST /api/issues', () => {
    it('stores the report trimmed, with the sender, and blank optional fields as null', async () => {
        const u = await signedInUser()
        const res = await post(u.token, ISSUES, {
            type: 'feedback',
            description: '  Add dark widgets  ',
            path: '   ',
            client: ' Trackbit Android 0.1.0 (1) · Google Pixel 8 · Android 16 (API 36) ',
            stackTrace: null,
        })
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body).toMatchObject({
            type: 'feedback',
            description: 'Add dark widgets',
            path: null,
            client: 'Trackbit Android 0.1.0 (1) · Google Pixel 8 · Android 16 (API 36)',
            stackTrace: null,
            title: null,
            status: 'open',
            userId: u.id,
        })
        const [row] = await db.select().from(issues).where(eq(issues.id, body.id))
        expect(row.description).toBe('Add dark widgets')
    })

    it('defaults to a bug and keeps the web route and stack trace', async () => {
        const u = await signedInUser()
        const res = await post(u.token, ISSUES, { description: 'Crash', path: '/tracker', stackTrace: 'Error: x\n  at y' })
        expect(res.status).toBe(201)
        expect(await res.json()).toMatchObject({ type: 'bug', path: '/tracker', stackTrace: 'Error: x\n  at y' })
    })

    it('refuses a blank or too long description, too long context and unknown fields', async () => {
        const { token } = await signedInUser()
        expect((await post(token, ISSUES, { description: '   ' })).status).toBe(400)
        expect((await post(token, ISSUES, { description: 'x'.repeat(5001) })).status).toBe(400)
        expect((await post(token, ISSUES, { description: 'Ok', client: 'x'.repeat(256) })).status).toBe(400)
        expect((await post(token, ISSUES, { description: 'Ok', path: 'x'.repeat(501) })).status).toBe(400)
        expect((await post(token, ISSUES, { description: 'Ok', type: 'praise' })).status).toBe(400)
        // A client can't file a report as already handled.
        expect((await post(token, ISSUES, { description: 'Ok', status: 'resolved' })).status).toBe(400)
    })

    it('needs a session', async () => {
        const res = await app.request(ISSUES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'Hi' }),
        })
        expect(res.status).toBe(401)
    })
})
