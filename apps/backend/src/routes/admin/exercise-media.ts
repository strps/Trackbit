import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm'
import {
    EXERCISE_MEDIA_ALT_MAX_LENGTH,
    EXERCISE_MEDIA_MAX_BYTES,
    EXERCISE_MEDIA_MAX_PER_EXERCISE,
    EXERCISE_MEDIA_TYPES,
    type ExerciseMediaType,
} from '@trackbit/types'
import db from '../../db/db.js'
import { exerciseMedia, exercises } from '../../db/schema/index.js'
import { validator } from '../../lib/validator.js'
import { isUniqueViolation } from '../../lib/db-errors.js'
import { mediaStore } from '../../lib/media-store.js'

// A system exercise's images. The browser uploads a file straight to the media store with a token
// from `upload-token`, then records it here; the API re-reads its size and type from the store,
// so a client can't lie about them. Every write locks the exercise row, so the positions stay
// 0..n-1 and the limit holds under concurrent requests.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const EXTENSIONS: Record<ExerciseMediaType, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }
const STORE_RULES = { contentTypes: EXERCISE_MEDIA_TYPES, maxBytes: EXERCISE_MEDIA_MAX_BYTES }

/** Where an exercise's files go; a key outside it is never recorded for that exercise. */
const keyPrefix = (exerciseUuid: string) => `exercises/${exerciseUuid}/`

// Blank translations are dropped, and none at all is stored as null.
const altSchema = z.object({
    en: z.string().trim().max(EXERCISE_MEDIA_ALT_MAX_LENGTH).optional(),
    es: z.string().trim().max(EXERCISE_MEDIA_ALT_MAX_LENGTH).optional(),
}).strict().nullable().transform((translations) => {
    const kept = Object.fromEntries(Object.entries(translations ?? {}).filter(([, text]) => text))
    return Object.keys(kept).length > 0 ? kept : null
})

const dimension = z.number().int().positive().max(10_000)

const uploadTokenSchema = z.object({ contentType: z.enum(EXERCISE_MEDIA_TYPES) }).strict()
const recordSchema = z.object({
    key: z.string().min(1).max(300),
    width: dimension,
    height: dimension,
    animated: z.boolean(),
    alt: altSchema.optional(),
}).strict()
const altBodySchema = z.object({ alt: altSchema }).strict()
const orderSchema = z.object({ uuids: z.array(z.uuid()).max(EXERCISE_MEDIA_MAX_PER_EXERCISE) }).strict()

const idParam = z.object({ id: z.coerce.number().int().positive() })
const mediaParam = idParam.extend({ uuid: z.uuid() })

/** What the admin sees of one image. */
const adminColumns = {
    uuid: exerciseMedia.uuid,
    url: exerciseMedia.url,
    mimeType: exerciseMedia.mimeType,
    animated: exerciseMedia.animated,
    width: exerciseMedia.width,
    height: exerciseMedia.height,
    bytes: exerciseMedia.bytes,
    position: exerciseMedia.position,
    altI18n: exerciseMedia.altI18n,
}

const notFound = { error: 'exercise_not_found', message: 'No such system exercise.' } as const
const limitReached = {
    error: 'media_limit_reached',
    message: `An exercise has at most ${EXERCISE_MEDIA_MAX_PER_EXERCISE} images.`,
} as const

/** A system exercise (the only kind with media), or undefined. With [tx], locked until it ends. */
async function systemExercise(id: number, tx?: Tx) {
    const query = (tx ?? db).select({ id: exercises.id, uuid: exercises.uuid }).from(exercises)
        .where(and(eq(exercises.id, id), isNull(exercises.userId)))
    const [row] = tx ? await query.for('update') : await query
    return row
}

const mediaCount = async (tx: Tx | typeof db, exerciseId: number) =>
    (await tx.select({ n: count() }).from(exerciseMedia).where(eq(exerciseMedia.exerciseId, exerciseId)))[0].n

/**
 * Gives [exerciseId]'s media the positions 0..n-1 in [uuids] order. Moves them all past the limit
 * first: the unique (exercise, position) index is checked row by row, so a direct swap collides.
 */
async function rewritePositions(tx: Tx, exerciseId: number, uuids: string[]) {
    if (uuids.length === 0) return
    await tx.update(exerciseMedia)
        .set({ position: sql`${exerciseMedia.position} + ${EXERCISE_MEDIA_MAX_PER_EXERCISE}` })
        .where(eq(exerciseMedia.exerciseId, exerciseId))
    const positions = sql.join(uuids.map((uuid, i) => sql`WHEN ${uuid}::uuid THEN ${i}::integer`), sql` `)
    await tx.update(exerciseMedia)
        .set({ position: sql`CASE ${exerciseMedia.uuid} ${positions} END` })
        .where(eq(exerciseMedia.exerciseId, exerciseId))
}

/**
 * Deletes files whose rows are already gone. A failure leaves an orphan file, never a row without
 * its file, so it's logged rather than failing a request whose change is done.
 */
export async function deleteStoredFiles(keys: string[]) {
    try {
        await mediaStore.delete(keys)
    } catch (err) {
        console.error('Could not delete media files', keys, err)
    }
}

const media = new Hono()

media.post('/upload-token', validator('param', idParam), validator('json', uploadTokenSchema), async (c) => {
    const exercise = await systemExercise(c.req.valid('param').id)
    if (!exercise) return c.json(notFound, 404)
    // Checked again when it's recorded; this only saves uploading a file that couldn't be.
    if (await mediaCount(db, exercise.id) >= EXERCISE_MEDIA_MAX_PER_EXERCISE) return c.json(limitReached, 409)

    const key = `${keyPrefix(exercise.uuid)}${randomUUID()}.${EXTENSIONS[c.req.valid('json').contentType]}`
    return c.json({ key, token: await mediaStore.uploadToken(key, STORE_RULES) })
})

media.post('/', validator('param', idParam), validator('json', recordSchema), async (c) => {
    const { key, alt, ...image } = c.req.valid('json')
    const exercise = await systemExercise(c.req.valid('param').id)
    if (!exercise) return c.json(notFound, 404)
    if (!key.startsWith(keyPrefix(exercise.uuid))) {
        return c.json({ error: 'invalid_media', message: 'That file is not one of this exercise\'s uploads.' }, 400)
    }

    const file = await mediaStore.head(key)
    if (!file) return c.json({ error: 'media_not_uploaded', message: 'No file was uploaded under that key.' }, 400)
    if (!(EXERCISE_MEDIA_TYPES as readonly string[]).includes(file.contentType) || file.bytes > EXERCISE_MEDIA_MAX_BYTES) {
        await deleteStoredFiles([key])
        return c.json({ error: 'invalid_media', message: 'Images must be WebP, JPEG or PNG, up to 2 MB.' }, 400)
    }

    let created
    try {
        created = await db.transaction(async (tx) => {
            if (!await systemExercise(exercise.id, tx)) return 'gone' as const
            const position = await mediaCount(tx, exercise.id)
            if (position >= EXERCISE_MEDIA_MAX_PER_EXERCISE) return 'full' as const
            const [row] = await tx.insert(exerciseMedia).values({
                ...image,
                exerciseId: exercise.id,
                url: file.url,
                storageKey: key,
                mimeType: file.contentType,
                bytes: file.bytes,
                position,
                altI18n: alt ?? null,
            }).returning(adminColumns)
            return row
        })
    } catch (err) {
        // Recorded already (a retry): the file is in use, so it stays.
        if (isUniqueViolation(err, 'exercise_media_storage_key_unique')) {
            return c.json({ error: 'media_already_recorded', message: 'That file is recorded already.' }, 409)
        }
        throw err
    }
    if (created === 'gone' || created === 'full') {
        await deleteStoredFiles([key])
        return created === 'gone' ? c.json(notFound, 404) : c.json(limitReached, 409)
    }
    return c.json(created, 201)
})

media.patch('/order', validator('param', idParam), validator('json', orderSchema), async (c) => {
    const { id } = c.req.valid('param')
    const { uuids } = c.req.valid('json')
    const result = await db.transaction(async (tx) => {
        if (!await systemExercise(id, tx)) return 'gone' as const
        const current = await tx.select({ uuid: exerciseMedia.uuid }).from(exerciseMedia).where(eq(exerciseMedia.exerciseId, id))
        const known = new Set(current.map((row) => row.uuid))
        if (uuids.length !== known.size || new Set(uuids).size !== uuids.length || !uuids.every((uuid) => known.has(uuid))) {
            return 'mismatch' as const
        }
        await rewritePositions(tx, id, uuids)
        return tx.select(adminColumns).from(exerciseMedia).where(eq(exerciseMedia.exerciseId, id)).orderBy(asc(exerciseMedia.position))
    })
    if (result === 'gone') return c.json(notFound, 404)
    if (result === 'mismatch') {
        return c.json({ error: 'invalid_media_order', message: 'Give every image of the exercise exactly once.' }, 400)
    }
    return c.json(result)
})

media.patch('/:uuid', validator('param', mediaParam), validator('json', altBodySchema), async (c) => {
    const { id, uuid } = c.req.valid('param')
    const [updated] = await db.update(exerciseMedia)
        .set({ altI18n: c.req.valid('json').alt })
        .where(and(eq(exerciseMedia.exerciseId, id), eq(exerciseMedia.uuid, uuid)))
        .returning(adminColumns)
    if (!updated) return c.json({ error: 'media_not_found', message: 'No such image.' }, 404)
    return c.json(updated)
})

media.delete('/:uuid', validator('param', mediaParam), async (c) => {
    const { id, uuid } = c.req.valid('param')
    const deleted = await db.transaction(async (tx) => {
        if (!await systemExercise(id, tx)) return undefined
        const [row] = await tx.delete(exerciseMedia)
            .where(and(eq(exerciseMedia.exerciseId, id), eq(exerciseMedia.uuid, uuid)))
            .returning({ storageKey: exerciseMedia.storageKey })
        if (!row) return undefined
        // Closes the gap it left.
        const rest = await tx.select({ uuid: exerciseMedia.uuid }).from(exerciseMedia)
            .where(eq(exerciseMedia.exerciseId, id)).orderBy(asc(exerciseMedia.position))
        await rewritePositions(tx, id, rest.map((m) => m.uuid))
        return row
    })
    if (!deleted) return c.json({ error: 'media_not_found', message: 'No such image.' }, 404)
    await deleteStoredFiles([deleted.storageKey])
    return c.json({ success: true })
})

export default media
