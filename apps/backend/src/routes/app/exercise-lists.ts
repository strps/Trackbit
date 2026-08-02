import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, asc, count, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import db from '../../db/db.js'
import { exerciseListItems, exerciseLists, exercises } from '../../db/schema/index.js'
import { requireAuth } from '../../middleware/auth.js'
import { localeMiddleware } from '../../middleware/locale.js'
import { t } from '../../i18n/index.js'
import {
    computeFrozenListIds,
    computeFrozenListsForUser,
    getEffectiveLimits,
} from '../../lib/user-limits.js'
import { loadOwnedListWithItems, loadOwnedListsWithItems } from '../../lib/exercise-sources.js'

const LIST_NAME_UNIQUE_INDEX = 'exercise_lists_user_name_uq'

// Postgres unique violations surface as `code === '23505'` with the offending
// constraint name; node-postgres nests the original error under `cause`.
function isUniqueViolation(err: unknown, constraint: string): boolean {
    const e = err as { code?: string; constraint?: string; cause?: unknown }
    if (e?.code === '23505' && e?.constraint === constraint) return true
    if (e?.cause) return isUniqueViolation(e.cause, constraint)
    return false
}

type AuthEnv = {
    Variables: {
        user: any
        locale: string
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAuth)
app.use('*', localeMiddleware)

const prescriptionSchema = z.object({
    targetSets: z.number().int().min(0).nullable().default(null),
    targetReps: z.number().int().min(0).nullable().default(null),
    targetWeight: z.number().min(0).nullable().default(null),
    targetDuration: z.number().int().min(0).nullable().default(null),
    targetDistance: z.number().min(0).nullable().default(null),
    restSeconds: z.number().int().min(0).nullable().default(null),
    notes: z.string().max(500).nullable().default(null),
})

const itemInputSchema = prescriptionSchema.extend({
    // Present ⇒ keep this row (and the exercise_log rows pointing at it).
    // Absent ⇒ a new item.
    id: z.number().int().positive().optional(),
    exerciseId: z.number().int().positive(),
    position: z.number().int().min(0),
})

function frozenListResponse(listId: number) {
    return {
        error: 'exercise_list_frozen',
        message: 'This list is frozen because your role limits were reduced. Delete it or another to free a slot.',
        listId,
    } as const
}

// Loads a list the user owns, or null. Every write path funnels through here so
// an unknown/unowned id is always a 404 and never a leak.
async function findOwnedList(userId: string, listId: number) {
    const [row] = await db
        .select()
        .from(exerciseLists)
        .where(and(eq(exerciseLists.id, listId), eq(exerciseLists.userId, userId)))
        .limit(1)
    return row ?? null
}

// GET /api/exercise-lists — every list with its items, ordered.
app.get('/', async (c) => {
    const user = c.get('user')

    const rows = await loadOwnedListsWithItems(user.id)
    const limits = await getEffectiveLimits(user.role)
    const frozen = computeFrozenListIds(rows.map((row) => row.list), limits)

    return c.json(rows.map(({ list, items }) => ({
        ...list,
        items,
        frozen: frozen.has(list.id),
    })))
})

// GET /api/exercise-lists/:id
app.get('/:id', async (c) => {
    const user = c.get('user')
    const id = Number(c.req.param('id'))

    const found = await loadOwnedListWithItems(user.id, id)
    if (!found) {
        return c.json({ error: t('errors', 'exercise_list_not_found', c.get('locale')) }, 404)
    }

    const frozen = await computeFrozenListsForUser(user.id, user.role)
    return c.json({ ...found.list, items: found.items, frozen: frozen.has(found.list.id) })
})

// POST /api/exercise-lists
app.post(
    '/',
    zValidator('json', z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).nullable().optional(),
    })),
    async (c) => {
        const user = c.get('user')
        const body = c.req.valid('json')

        const limits = await getEffectiveLimits(user.role)
        if (limits && limits.maxExerciseLists != null) {
            const [{ value: existingCount }] = await db
                .select({ value: count() })
                .from(exerciseLists)
                .where(eq(exerciseLists.userId, user.id))

            if (existingCount >= limits.maxExerciseLists) {
                return c.json({
                    error: 'exercise_list_limit_reached',
                    message: `You have reached the maximum of ${limits.maxExerciseLists} exercise lists for your role.`,
                    maxExerciseLists: limits.maxExerciseLists,
                }, 403)
            }
        }

        // Append at the end: MAX(position) + 1 over the user's own lists.
        const [{ value: nextPosition }] = await db
            .select({ value: sql<number>`COALESCE(MAX(${exerciseLists.position}), -1) + 1` })
            .from(exerciseLists)
            .where(eq(exerciseLists.userId, user.id))

        try {
            const [created] = await db.insert(exerciseLists).values({
                userId: user.id,
                authorId: user.id,
                name: body.name,
                description: body.description ?? null,
                position: nextPosition,
            }).returning()

            return c.json({ ...created, items: [], frozen: false }, 201)
        } catch (err) {
            if (isUniqueViolation(err, LIST_NAME_UNIQUE_INDEX)) {
                return c.json({
                    error: 'exercise_list_name_taken',
                    message: t('errors', 'exercise_list_name_taken', c.get('locale')),
                }, 409)
            }
            throw err
        }
    }
)

// PATCH /api/exercise-lists/:id
app.patch(
    '/:id',
    zValidator('json', z.object({
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(500).nullable().optional(),
        position: z.number().int().min(0).optional(),
    }).strict()),
    async (c) => {
        const user = c.get('user')
        const id = Number(c.req.param('id'))
        const updates = c.req.valid('json')

        const existing = await findOwnedList(user.id, id)
        if (!existing) {
            return c.json({ error: t('errors', 'exercise_list_not_found', c.get('locale')) }, 404)
        }

        const frozen = await computeFrozenListsForUser(user.id, user.role)
        if (frozen.has(id)) {
            return c.json(frozenListResponse(id), 403)
        }

        try {
            const [updated] = await db
                .update(exerciseLists)
                .set({ ...updates, updatedAt: new Date() })
                .where(and(eq(exerciseLists.id, id), eq(exerciseLists.userId, user.id)))
                .returning()

            return c.json(updated)
        } catch (err) {
            if (isUniqueViolation(err, LIST_NAME_UNIQUE_INDEX)) {
                return c.json({
                    error: 'exercise_list_name_taken',
                    message: t('errors', 'exercise_list_name_taken', c.get('locale')),
                }, 409)
            }
            throw err
        }
    }
)

// PUT /api/exercise-lists/:id/items — replace-all with positions.
//
// Replace-all is the client-facing contract, but the implementation diffs on
// item id rather than deleting every row: exercise_log.list_item_id is ON DELETE
// SET NULL, so a blind delete-and-reinsert would erase the provenance of every
// past log each time the list is reordered.
app.put(
    '/:id/items',
    zValidator('json', z.object({
        items: z.array(itemInputSchema),
    })),
    async (c) => {
        const user = c.get('user')
        const id = Number(c.req.param('id'))
        const { items } = c.req.valid('json')

        const existing = await findOwnedList(user.id, id)
        if (!existing) {
            return c.json({ error: t('errors', 'exercise_list_not_found', c.get('locale')) }, 404)
        }

        const frozen = await computeFrozenListsForUser(user.id, user.role)
        if (frozen.has(id)) {
            return c.json(frozenListResponse(id), 403)
        }

        // Positions must be a valid permutation; the DB constraint is deferred,
        // so duplicates would only blow up at COMMIT with an opaque error.
        const positions = new Set(items.map((it) => it.position))
        if (positions.size !== items.length) {
            return c.json({
                error: 'exercise_list_position_conflict',
                message: 'Item positions must be unique within a list.',
            }, 400)
        }

        // Only system exercises and the user's own customs may be referenced.
        const exerciseIds = [...new Set(items.map((it) => it.exerciseId))]
        if (exerciseIds.length > 0) {
            const available = await db
                .select({ id: exercises.id })
                .from(exercises)
                .where(and(
                    inArray(exercises.id, exerciseIds),
                    or(isNull(exercises.userId), eq(exercises.userId, user.id)),
                ))

            if (available.length !== exerciseIds.length) {
                return c.json({
                    error: 'exercise_not_available',
                    message: t('errors', 'exercise_not_available', c.get('locale')),
                }, 400)
            }
        }

        const currentIds = new Set(
            (await db
                .select({ id: exerciseListItems.id })
                .from(exerciseListItems)
                .where(eq(exerciseListItems.listId, id))
            ).map((row) => row.id)
        )

        // An id the caller doesn't own (or invented) is a client bug, not a
        // reason to silently create a row somewhere else.
        const unknownIds = items
            .map((it) => it.id)
            .filter((itemId): itemId is number => itemId !== undefined && !currentIds.has(itemId))
        if (unknownIds.length > 0) {
            return c.json({
                error: 'exercise_list_item_not_found',
                message: 'One or more item ids do not belong to this list.',
                itemIds: unknownIds,
            }, 400)
        }

        const keptIds = new Set(
            items.map((it) => it.id).filter((itemId): itemId is number => itemId !== undefined)
        )
        const removedIds = [...currentIds].filter((itemId) => !keptIds.has(itemId))

        // The unique(listId, position) constraint is DEFERRABLE INITIALLY
        // DEFERRED, so the intermediate states inside this transaction are fine.
        await db.transaction(async (tx) => {
            if (removedIds.length > 0) {
                await tx.delete(exerciseListItems).where(inArray(exerciseListItems.id, removedIds))
            }

            for (const item of items) {
                const values = {
                    listId: id,
                    exerciseId: item.exerciseId,
                    position: item.position,
                    targetSets: item.targetSets,
                    targetReps: item.targetReps,
                    targetWeight: item.targetWeight,
                    targetDuration: item.targetDuration,
                    targetDistance: item.targetDistance,
                    restSeconds: item.restSeconds,
                    notes: item.notes,
                }

                if (item.id !== undefined) {
                    await tx
                        .update(exerciseListItems)
                        .set(values)
                        .where(eq(exerciseListItems.id, item.id))
                } else {
                    await tx.insert(exerciseListItems).values(values)
                }
            }

            await tx
                .update(exerciseLists)
                .set({ updatedAt: new Date() })
                .where(eq(exerciseLists.id, id))
        })

        const updated = await db
            .select()
            .from(exerciseListItems)
            .where(eq(exerciseListItems.listId, id))
            .orderBy(asc(exerciseListItems.position))

        return c.json({ listId: id, items: updated })
    }
)

// DELETE /api/exercise-lists/:id
app.delete('/:id', async (c) => {
    const user = c.get('user')
    const id = Number(c.req.param('id'))

    const [deleted] = await db
        .delete(exerciseLists)
        .where(and(eq(exerciseLists.id, id), eq(exerciseLists.userId, user.id)))
        .returning()

    if (!deleted) {
        return c.json({ error: t('errors', 'exercise_list_not_found', c.get('locale')) }, 404)
    }

    return c.json({ success: true, deletedId: id })
})

export default app
