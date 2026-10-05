import { Hono } from 'hono'
import { validator } from '../../lib/validator.js'
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
import { isUniqueViolation } from '../../lib/db-errors.js'

const LIST_NAME_UNIQUE_INDEX = 'exercise_lists_user_name_uq'

type AuthEnv = {
    Variables: {
        user: any
        locale: string
    }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const app = new Hono<AuthEnv>()

app.use('*', requireAuth)
app.use('*', localeMiddleware)

// The list editor's rules (web and Android `ExerciseListRules`), enforced here so no client can
// store more. A blank description or note is stored as null.
const MAX_ITEMS = 100

// Nullable, not nullish: Zod 4 would run the transform for an omitted field too, and a PATCH
// without a description would then clear it.
const blankToNull = (max: number) => z.string().trim().max(max).nullable().transform((s) => s || null)

const listBodySchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: blankToNull(500).optional(),
}).strict()

// A list item's targets. Weights are kg and distances km, like the sets they pre-fill (the
// clients convert for display); durations are seconds. Null means "not prescribed".
const prescriptionSchema = z.object({
    targetSets: z.number().int().min(1).max(50).nullable().default(null),
    targetReps: z.number().int().min(1).max(1000).nullable().default(null),
    targetWeight: z.number().positive().max(1000).nullable().default(null),
    targetDuration: z.number().int().min(1).max(86_400).nullable().default(null),
    targetDistance: z.number().positive().max(1000).nullable().default(null),
    restSeconds: z.number().int().min(0).max(3600).nullable().default(null),
    notes: blankToNull(500).default(null),
})

const itemInputSchema = prescriptionSchema.extend({
    // Present ⇒ keep this row (and the exercise_log rows pointing at it).
    // Absent ⇒ a new item.
    id: z.number().int().positive().optional(),
    exerciseId: z.number().int().positive(),
    position: z.number().int().min(0),
}).strict()

const idParamSchema = z.object({ id: z.coerce.number().int().positive() })

const FROZEN_LIST_MESSAGE = 'This list is frozen because your role limits were reduced. Delete it or another to free a slot.'

function frozenListResponse(listId: number) {
    return { error: 'exercise_list_frozen', message: FROZEN_LIST_MESSAGE, listId } as const
}

function notFound(locale: string) {
    return { error: t('errors', 'exercise_list_not_found', locale) }
}

function nameTaken(locale: string) {
    return { error: 'exercise_list_name_taken', message: t('errors', 'exercise_list_name_taken', locale) } as const
}

/** The list [listId] owned by [userId], locked for the rest of [tx], or null. */
async function lockOwnedList(tx: Tx, userId: string, listId: number) {
    const [row] = await tx
        .select({ id: exerciseLists.id })
        .from(exerciseLists)
        .where(and(eq(exerciseLists.id, listId), eq(exerciseLists.userId, userId)))
        .for('update')
    return row ?? null
}

/** True when every one of [exerciseIds] is a system exercise or [userId]'s own. */
async function exercisesAvailable(tx: Tx, userId: string, exerciseIds: number[]) {
    const unique = [...new Set(exerciseIds)]
    if (unique.length === 0) return true
    const available = await tx
        .select({ id: exercises.id })
        .from(exercises)
        .where(and(
            inArray(exercises.id, unique),
            or(isNull(exercises.userId), eq(exercises.userId, userId)),
        ))
    return available.length === unique.length
}

async function itemsOf(listId: number) {
    return db
        .select()
        .from(exerciseListItems)
        .where(eq(exerciseListItems.listId, listId))
        .orderBy(asc(exerciseListItems.position))
}

/** The list as GET /:id answers it: with its items and whether it's frozen. */
async function listResponse(user: { id: string; role?: string | null }, listId: number) {
    const found = await loadOwnedListWithItems(user.id, listId)
    if (!found) return null
    const frozen = await computeFrozenListsForUser(user.id, user.role)
    return { ...found.list, items: found.items, frozen: frozen.has(found.list.id) }
}

/** Thrown inside a transaction to roll it back and answer with [body] and [status]. */
class Refusal extends Error {
    constructor(readonly status: 400 | 403 | 404, readonly body: object) {
        super('refused')
    }
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

// PATCH /api/exercise-lists/reorder — every one of the user's lists, in its new order.
//
// One call in one transaction (it used to be a PATCH per list, which could stop halfway). The
// freeze walks positions, so an order that would freeze a different set of lists is refused:
// frozen lists stay at the end, as frozen habits stay in their group.
app.patch(
    '/reorder',
    validator('json', z.object({ ids: z.array(z.number().int().positive()) }).strict()),
    async (c) => {
        const user = c.get('user')
        const { ids } = c.req.valid('json')

        const owned = await db
            .select({ id: exerciseLists.id, position: exerciseLists.position })
            .from(exerciseLists)
            .where(eq(exerciseLists.userId, user.id))
        const ownedIds = new Set(owned.map((row) => row.id))
        if (new Set(ids).size !== ids.length || ids.length !== ownedIds.size || ids.some((id) => !ownedIds.has(id))) {
            return c.json({
                error: 'exercise_list_order_mismatch',
                message: 'The order must name each of your lists exactly once.',
            }, 400)
        }

        const limits = await getEffectiveLimits(user.role)
        const frozenNow = computeFrozenListIds(owned, limits)
        const frozenAfter = computeFrozenListIds(ids.map((id, position) => ({ id, position })), limits)
        const changed = [...new Set([...frozenNow, ...frozenAfter])].filter((id) => frozenNow.has(id) !== frozenAfter.has(id))
        if (changed.length > 0) {
            return c.json({ error: 'exercise_list_frozen', message: FROZEN_LIST_MESSAGE, listIds: [...frozenNow] }, 403)
        }

        await db.transaction(async (tx) => {
            for (const [position, id] of ids.entries()) {
                await tx.update(exerciseLists)
                    .set({ position, updatedAt: new Date() })
                    .where(and(eq(exerciseLists.id, id), eq(exerciseLists.userId, user.id)))
            }
        })

        const rows = await loadOwnedListsWithItems(user.id)
        return c.json(rows.map(({ list, items }) => ({ ...list, items, frozen: frozenAfter.has(list.id) })))
    }
)

// GET /api/exercise-lists/:id
app.get('/:id', validator('param', idParamSchema), async (c) => {
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const found = await listResponse(user, id)
    if (!found) return c.json(notFound(c.get('locale')), 404)
    return c.json(found)
})

// POST /api/exercise-lists
app.post(
    '/',
    validator('json', listBodySchema),
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
                return c.json(nameTaken(c.get('locale')), 409)
            }
            throw err
        }
    }
)

// PATCH /api/exercise-lists/:id — name and description; the order goes through /reorder.
app.patch(
    '/:id',
    validator('param', idParamSchema),
    validator('json', listBodySchema.partial().refine(
        (data) => Object.values(data).some((value) => value !== undefined),
        { message: 'At least one field must be provided for update' },
    )),
    async (c) => {
        const user = c.get('user')
        const { id } = c.req.valid('param')
        const updates = c.req.valid('json')

        const frozen = await computeFrozenListsForUser(user.id, user.role)
        if (frozen.has(id)) {
            return c.json(frozenListResponse(id), 403)
        }

        try {
            const [updated] = await db
                .update(exerciseLists)
                .set({ ...updates, updatedAt: new Date() })
                .where(and(eq(exerciseLists.id, id), eq(exerciseLists.userId, user.id)))
                .returning({ id: exerciseLists.id })
            if (!updated) return c.json(notFound(c.get('locale')), 404)
        } catch (err) {
            if (isUniqueViolation(err, LIST_NAME_UNIQUE_INDEX)) {
                return c.json(nameTaken(c.get('locale')), 409)
            }
            throw err
        }

        return c.json(await listResponse(user, id))
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
    validator('param', idParamSchema),
    validator('json', z.object({
        items: z.array(itemInputSchema).max(MAX_ITEMS),
    }).strict()),
    async (c) => {
        const user = c.get('user')
        const { id } = c.req.valid('param')
        const { items } = c.req.valid('json')
        const locale = c.get('locale')

        // Positions must be a valid permutation; the DB constraint is deferred,
        // so duplicates would only blow up at COMMIT with an opaque error.
        const positions = new Set(items.map((it) => it.position))
        if (positions.size !== items.length) {
            return c.json({
                error: 'exercise_list_position_conflict',
                message: 'Item positions must be unique within a list.',
            }, 400)
        }

        const frozen = await computeFrozenListsForUser(user.id, user.role)
        if (frozen.has(id)) {
            return c.json(frozenListResponse(id), 403)
        }

        try {
            // The list row is locked, so a concurrent append or replace waits for this one.
            await db.transaction(async (tx) => {
                if (!await lockOwnedList(tx, user.id, id)) throw new Refusal(404, notFound(locale))

                // Only system exercises and the user's own customs may be referenced.
                if (!await exercisesAvailable(tx, user.id, items.map((it) => it.exerciseId))) {
                    throw new Refusal(400, {
                        error: 'exercise_not_available',
                        message: t('errors', 'exercise_not_available', locale),
                    })
                }

                const currentIds = new Set(
                    (await tx
                        .select({ id: exerciseListItems.id })
                        .from(exerciseListItems)
                        .where(eq(exerciseListItems.listId, id))
                    ).map((row) => row.id)
                )

                // An id the caller doesn't own (or invented, or sent twice) is a client bug, not
                // a reason to silently create a row somewhere else.
                const keptIds = items.map((it) => it.id).filter((itemId): itemId is number => itemId !== undefined)
                const unknownIds = keptIds.filter((itemId, i) => !currentIds.has(itemId) || keptIds.indexOf(itemId) !== i)
                if (unknownIds.length > 0) {
                    throw new Refusal(400, {
                        error: 'exercise_list_item_not_found',
                        message: 'One or more item ids do not belong to this list.',
                        itemIds: unknownIds,
                    })
                }

                const kept = new Set(keptIds)
                const removedIds = [...currentIds].filter((itemId) => !kept.has(itemId))

                if (removedIds.length > 0) {
                    await tx.delete(exerciseListItems).where(inArray(exerciseListItems.id, removedIds))
                }

                // Two phases, like the habits reorder, so no intermediate state breaks
                // unique(listId, position) whether or not the database defers it (0006 asks for
                // DEFERRABLE, but a pushed schema, as in tests and some databases, isn't): the kept
                // rows are parked on negative positions first, then everything takes its place.
                if (kept.size > 0) {
                    await tx.update(exerciseListItems)
                        .set({ position: sql`-1 - ${exerciseListItems.position}` })
                        .where(inArray(exerciseListItems.id, [...kept]))
                }

                for (const { id: itemId, ...values } of items) {
                    if (itemId !== undefined) {
                        await tx.update(exerciseListItems).set(values).where(eq(exerciseListItems.id, itemId))
                    } else {
                        await tx.insert(exerciseListItems).values({ listId: id, ...values })
                    }
                }

                await tx.update(exerciseLists).set({ updatedAt: new Date() }).where(eq(exerciseLists.id, id))
            })
        } catch (err) {
            if (err instanceof Refusal) return c.json(err.body, err.status)
            throw err
        }

        return c.json({ listId: id, items: await itemsOf(id) })
    }
)

// POST /api/exercise-lists/:id/items — appends one exercise, unprescribed. The "add to list"
// menus use it instead of a replace-all built from a possibly stale copy of the items.
app.post(
    '/:id/items',
    validator('param', idParamSchema),
    validator('json', z.object({ exerciseId: z.number().int().positive() }).strict()),
    async (c) => {
        const user = c.get('user')
        const { id } = c.req.valid('param')
        const { exerciseId } = c.req.valid('json')
        const locale = c.get('locale')

        const frozen = await computeFrozenListsForUser(user.id, user.role)
        if (frozen.has(id)) {
            return c.json(frozenListResponse(id), 403)
        }

        try {
            await db.transaction(async (tx) => {
                if (!await lockOwnedList(tx, user.id, id)) throw new Refusal(404, notFound(locale))
                if (!await exercisesAvailable(tx, user.id, [exerciseId])) {
                    throw new Refusal(400, {
                        error: 'exercise_not_available',
                        message: t('errors', 'exercise_not_available', locale),
                    })
                }

                const [{ size, next }] = await tx
                    .select({
                        size: count(),
                        next: sql<number>`COALESCE(MAX(${exerciseListItems.position}), -1) + 1`,
                    })
                    .from(exerciseListItems)
                    .where(eq(exerciseListItems.listId, id))
                if (size >= MAX_ITEMS) {
                    throw new Refusal(400, {
                        error: 'exercise_list_full',
                        message: `A list holds at most ${MAX_ITEMS} exercises.`,
                        maxItems: MAX_ITEMS,
                    })
                }

                await tx.insert(exerciseListItems).values({ listId: id, exerciseId, position: next })
                await tx.update(exerciseLists).set({ updatedAt: new Date() }).where(eq(exerciseLists.id, id))
            })
        } catch (err) {
            if (err instanceof Refusal) return c.json(err.body, err.status)
            throw err
        }

        return c.json({ listId: id, items: await itemsOf(id) }, 201)
    }
)

// DELETE /api/exercise-lists/:id — frozen lists too: deleting one is how the user frees a slot.
app.delete('/:id', validator('param', idParamSchema), async (c) => {
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const [deleted] = await db
        .delete(exerciseLists)
        .where(and(eq(exerciseLists.id, id), eq(exerciseLists.userId, user.id)))
        .returning()

    if (!deleted) {
        return c.json(notFound(c.get('locale')), 404)
    }

    return c.json({ success: true, deletedId: id })
})

export default app
