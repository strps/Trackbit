import { createMiddleware } from 'hono/factory'
import { and, eq, lt, sql } from 'drizzle-orm'
import db from '../db/db.js'
import { idempotencyKeys } from '../db/schema/index.js'
import { t, negotiateFromHeader } from '../i18n/index.js'

/** Keys are kept this long; a client retrying later than this gets a fresh execution. */
const RETENTION = '24 hours'
/** A reservation with no stored response after this long is from a crashed request. */
const STALE_RESERVATION = '1 minute'
const MAX_KEY_LENGTH = 255

/**
 * Opt-in per route, after requireAuth. When the request carries an
 * `Idempotency-Key`, the first successful (2xx) response is stored per
 * (user, key) and replayed verbatim for any retry with the same key.
 * Requests without the header run normally.
 */
export const idempotency = createMiddleware<{ Variables: { user: any } }>(async (c, next) => {
    const key = c.req.header('idempotency-key')
    if (!key) return next()

    const locale = negotiateFromHeader(c.req.header('accept-language'))
    if (key.length > MAX_KEY_LENGTH) {
        return c.json({ error: t('errors', 'idempotency_key_invalid', locale) }, 400)
    }

    const userId: string = c.get('user').id
    const method = c.req.method
    const path = c.req.path
    const match = and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key))

    await db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, sql`now() - ${RETENTION}::interval`))
    await db.delete(idempotencyKeys).where(and(
        match,
        sql`${idempotencyKeys.status} IS NULL`,
        lt(idempotencyKeys.createdAt, sql`now() - ${STALE_RESERVATION}::interval`),
    ))

    const reserved = await db
        .insert(idempotencyKeys)
        .values({ userId, key, method, path })
        .onConflictDoNothing()
        .returning({ key: idempotencyKeys.key })

    if (reserved.length === 0) {
        const [existing] = await db.select().from(idempotencyKeys).where(match).limit(1)
        if (existing.method !== method || existing.path !== path) {
            return c.json({ error: t('errors', 'idempotency_key_reused', locale) }, 422)
        }
        if (existing.status === null) {
            return c.json({ error: t('errors', 'idempotency_request_in_progress', locale) }, 409)
        }
        return new Response(existing.body, {
            status: existing.status,
            headers: {
                ...(existing.contentType && { 'content-type': existing.contentType }),
                'idempotent-replayed': 'true',
            },
        })
    }

    let stored = false
    try {
        await next()
        if (c.res.status >= 200 && c.res.status < 300) {
            await db
                .update(idempotencyKeys)
                .set({
                    status: c.res.status,
                    contentType: c.res.headers.get('content-type'),
                    body: await c.res.clone().text(),
                })
                .where(match)
            stored = true
        }
    } finally {
        // Failed requests release the key so the client's retry runs for real.
        if (!stored) await db.delete(idempotencyKeys).where(match)
    }
})
