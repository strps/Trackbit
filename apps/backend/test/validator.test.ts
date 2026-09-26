import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import db from '../src/db/db.js'
import { user } from '../src/db/schema/index.js'
import { app, bearer, createHabit, post, signedInUser } from './helpers.js'

describe('validation errors', () => {
    it('answer with the documented { message, errors } body', async () => {
        const u = await signedInUser()
        const habit = await createHabit(u.id)

        const res = await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 'lots' })

        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({
            message: 'Validation failed',
            errors: [expect.objectContaining({ path: 'rating', code: 'invalid_type', message: expect.any(String) })],
        })
    })

    it('cover query parameters too', async () => {
        const u = await signedInUser()
        const res = await app.request('/api/tracker/today?day=yesterday', bearer(u.token))
        expect(res.status).toBe(400)
        expect((await res.json()).errors[0].path).toBe('day')
    })

    it("are in the user's language, even on routes without localeMiddleware", async () => {
        const u = await signedInUser()
        await db.update(user).set({ locale: 'es' }).where(eq(user.id, u.id))

        const res = await post(u.token, '/api/tracker/check/increment', { habitId: 1, delta: 0 })

        expect(res.status).toBe(400)
        expect((await res.json()).message).toBe('Error de validación')
    })
})

describe('validator usage', () => {
    // Without validator()'s hook, @hono/zod-validator answers { success: false, error: <ZodError> }.
    it('no route imports @hono/zod-validator directly', () => {
        const src = join(import.meta.dirname, '../src')
        const files = (function walk(dir: string): string[] {
            return readdirSync(dir).flatMap((name) => {
                const path = join(dir, name)
                return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : []
            })
        })(src)
        const offenders = files
            .filter((f) => relative(src, f) !== join('lib', 'validator.ts'))
            .filter((f) => readFileSync(f, 'utf8').includes('@hono/zod-validator'))
            .map((f) => relative(src, f))
        expect(offenders).toEqual([])
    })
})
