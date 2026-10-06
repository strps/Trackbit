import { Hono, type Context } from 'hono'
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
import { loadOwnedListWithItems, loadOwnedListsWithItems, selectItems } from '../../lib/exercise-sources.js'
import { isUniqueViolation } from '../../lib/db-errors.js'
import { atMostOne, createdBefore, listIdByUuid, oneOf, uuidParamSchema } from '../../lib/uuid-refs.js'

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

// Chosen by a client creating the list offline; a retry with it returns the same list.
const listCreateSchema = listBodySchema.extend({ uuid: z.uuid().optional() }).strict()

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
    // A client's own name for the item instead of `id`: an item of this list by that uuid is kept,
    // otherwise a new item is created with it.
    uuid: z.uuid().optional(),
    exerciseId: z.number().int().positive().optional(),
    exerciseUuid: z.uuid().optional(),
    position: z.number().int().min(0),
}).strict()
    .refine(atMostOne('id', 'uuid'), { message: 'Give id or uuid, not both', path: ['id'] })
    .refine(oneOf('exerciseId', 'exerciseUuid'), { message: 'Give exerciseId or exerciseUuid', path: ['exerciseId'] })

const idParamSchema = z.object({ id: z.coerce.number().int().positive() })

const FROZEN_LIST_MESSAGE = 'This list is frozen because your role limits were reduced. Delete it or another to free a slot.'

function frozenListResponse(listId: number) {
    return { error: 'exercise_list_frozen', message: FROZEN_LIST_MESSAGE, listId } as const
}

function notFound(locale: string) {
    return { error: t('errors', 'exercise_list_not_found', locale) }
}

const UUID_CONFLICT = { error: 'uuid_conflict', message: 'This uuid already names another row.' } as const

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

/** [uuids] of exercises [userId] may use (system or own), as uuid → id; missing ones are left out. */
async function availableExerciseIds(tx: Tx, userId: string, uuids: string[]) {
    const unique = [...new Set(uuids)]
    if (unique.length === 0) return new Map<string, number>()
    const rows = await tx
        .select({ id: exercises.id, uuid: exercises.uuid })
        .from(exercises)
        .where(and(inArray(exercises.uuid, unique), or(isNull(exercises.userId), eq(exercises.userId, userId))))
    return new Map(rows.map((row) => [row.uuid, row.id]))
}

function exerciseNotAvailable(locale: string) {
    return new Refusal(400, { error: 'exercise_not_available', message: t('errors', 'exercise_not_available', locale) })
}

/** The items response: the list's items in order, each with its exercise's uuid. */
async function itemsResponse(listId: number) {
    const [list] = await db.select({ uuid: exerciseLists.uuid }).from(exerciseLists).where(eq(exerciseLists.id, listId))
    const items = await selectItems().where(eq(exerciseListItems.listId, listId)).orderBy(asc(exerciseListItems.position))
    return { listId, listUuid: list.uuid, items }
}

/** The list as GET /:id answers it: with its items and whether it's frozen. */
async function listResponse(user: { id: string; role?: string | null }, listId: number) {
    const found = await loadOwnedListWithItems(user.id, { id: listId })
    if (!found) return null
    const frozen = await computeFrozenListsForUser(user.id, user.role)
    return { ...found.list, items: found.items, frozen: frozen.has(found.list.id) }
}

/** Thrown inside a transaction to roll it back and answer with [body] and [status]. */
class Refusal extends Error {
    constructor(readonly status: 400 | 403 | 404 | 409, readonly body: object) {
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
    // Every list by id, or every list by uuid.
    validator('json', z.object({
        ids: z.array(z.number().int().positive()).optional(),
        uuids: z.array(z.uuid()).optional(),
    }).strict().refine(oneOf('ids', 'uuids'), { message: 'Give ids or uuids', path: ['ids'] })),
    async (c) => {
        const user = c.get('user')
        const body = c.req.valid('json')

        const owned = await db
            .select({ id: exerciseLists.id, uuid: exerciseLists.uuid, position: exerciseLists.position })
            .from(exerciseLists)
            .where(eq(exerciseLists.userId, user.id))
        // An unknown uuid becomes an id no list has, which the check below refuses.
        const idByUuid = new Map(owned.map((row) => [row.uuid, row.id]))
        const ids = body.ids ?? body.uuids!.map((uuid) => idByUuid.get(uuid) ?? 0)
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

// Every route on one list takes it as `/:id` or as `/uuid/:uuid`; a uuid naming none of the
// user's lists is resolved to undefined, which answers 404 like an unknown id.
type ListParam = number | undefined

const listByUuid = async (c: Context<AuthEnv>) => listIdByUuid(c.get('user').id, c.req.param('uuid')!)

async function getList(c: Context<AuthEnv>, id: ListParam) {
    const found = id === undefined ? null : await listResponse(c.get('user'), id)
    if (!found) return c.json(notFound(c.get('locale')), 404)
    return c.json(found)
}

// GET /api/exercise-lists/:id
app.get('/:id', validator('param', idParamSchema), (c) => getList(c, c.req.valid('param').id))
app.get('/uuid/:uuid', validator('param', uuidParamSchema), async (c) => getList(c, await listByUuid(c)))

/** The list a create with [uuid] already made (a retry), if any; see lib/uuid-refs.ts. */
const listCreatedBefore = (uuid: string | undefined, userId: string) =>
    createdBefore(uuid, (u) => db.select({ id: exerciseLists.id, userId: exerciseLists.userId }).from(exerciseLists).where(eq(exerciseLists.uuid, u)), userId)

// POST /api/exercise-lists
app.post(
    '/',
    validator('json', listCreateSchema),
    async (c) => {
        const user = c.get('user')
        const body = c.req.valid('json')

        // A retried create answers with what it made, before the limits (see habits).
        const existing = await listCreatedBefore(body.uuid, user.id)
        if (existing) return c.json(await listResponse(user, existing.id), 201)

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
                uuid: body.uuid,
                userId: user.id,
                authorId: user.id,
                name: body.name,
                description: body.description ?? null,
                position: nextPosition,
            }).returning()

            return c.json({ ...created, items: [], frozen: false }, 201)
        } catch (err) {
            // The same create ran concurrently and won.
            if (isUniqueViolation(err, 'exercise_lists_uuid_unique')) {
                const won = await listCreatedBefore(body.uuid, user.id)
                if (won) return c.json(await listResponse(user, won.id), 201)
            }
            if (isUniqueViolation(err, LIST_NAME_UNIQUE_INDEX)) {
                return c.json(nameTaken(c.get('locale')), 409)
            }
            throw err
        }
    }
)

const listUpdateSchema = listBodySchema.partial().refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: 'At least one field must be provided for update' },
)

/**
 * Name and description; the order goes through /reorder. Only the fields given change, so
 * concurrent edits of different fields both survive.
 */
async function updateList(c: Context<AuthEnv>, id: ListParam, updates: z.infer<typeof listUpdateSchema>) {
    const user = c.get('user')
    if (id === undefined) return c.json(notFound(c.get('locale')), 404)

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

// PATCH /api/exercise-lists/:id
app.patch('/:id', validator('param', idParamSchema), validator('json', listUpdateSchema),
    (c) => updateList(c, c.req.valid('param').id, c.req.valid('json')))
app.patch('/uuid/:uuid', validator('param', uuidParamSchema), validator('json', listUpdateSchema),
    async (c) => updateList(c, await listByUuid(c), c.req.valid('json')))

const itemsBodySchema = z.object({ items: z.array(itemInputSchema).max(MAX_ITEMS) }).strict()

// PUT /api/exercise-lists/:id/items — replace-all with positions.
//
// Replace-all is the client-facing contract, but the implementation diffs on
// item id rather than deleting every row: exercise_log.list_item_id is ON DELETE
// SET NULL, so a blind delete-and-reinsert would erase the provenance of every
// past log each time the list is reordered.
async function putItems(c: Context<AuthEnv>, id: ListParam, items: z.infer<typeof itemsBodySchema>['items']) {
    const user = c.get('user')
    const locale = c.get('locale')
    if (id === undefined) return c.json(notFound(locale), 404)

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
            const exerciseIdOf = await availableExerciseIds(tx, user.id,
                items.flatMap((it) => it.exerciseUuid === undefined ? [] : [it.exerciseUuid]))
            if (items.some((it) => it.exerciseUuid !== undefined && !exerciseIdOf.has(it.exerciseUuid))) {
                throw exerciseNotAvailable(locale)
            }
            if (!await exercisesAvailable(tx, user.id, items.flatMap((it) => it.exerciseId === undefined ? [] : [it.exerciseId]))) {
                throw exerciseNotAvailable(locale)
            }

            const current = await tx
                .select({ id: exerciseListItems.id, uuid: exerciseListItems.uuid })
                .from(exerciseListItems)
                .where(eq(exerciseListItems.listId, id))
            const currentIds = new Set(current.map((row) => row.id))
            const currentIdByUuid = new Map(current.map((row) => [row.uuid, row.id]))

            // An id the caller doesn't own (or invented, or sent twice) is a client bug, not
            // a reason to silently create a row somewhere else. A uuid this list doesn't hold
            // is a new item's.
            const keptIds = items.map((it) => it.id ?? (it.uuid === undefined ? undefined : currentIdByUuid.get(it.uuid)))
                .filter((itemId): itemId is number => itemId !== undefined)
            const unknownIds = keptIds.filter((itemId, i) => !currentIds.has(itemId) || keptIds.indexOf(itemId) !== i)
            if (unknownIds.length > 0) {
                throw new Refusal(400, {
                    error: 'exercise_list_item_not_found',
                    message: 'One or more item ids do not belong to this list.',
                    itemIds: unknownIds,
                })
            }
            const newUuids = items.flatMap((it) => it.uuid !== undefined && !currentIdByUuid.has(it.uuid) ? [it.uuid] : [])
            if (new Set(newUuids).size !== newUuids.length) throw new Refusal(409, UUID_CONFLICT)
            if (newUuids.length > 0) {
                const taken = await tx.select({ id: exerciseListItems.id }).from(exerciseListItems)
                    .where(inArray(exerciseListItems.uuid, newUuids)).limit(1)
                if (taken.length > 0) throw new Refusal(409, UUID_CONFLICT)
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

            for (const { id: givenId, uuid, exerciseId, exerciseUuid, ...rest } of items) {
                const values = { ...rest, exerciseId: exerciseId ?? exerciseIdOf.get(exerciseUuid!)! }
                const itemId = givenId ?? (uuid === undefined ? undefined : currentIdByUuid.get(uuid))
                if (itemId !== undefined) {
                    await tx.update(exerciseListItems).set(values).where(eq(exerciseListItems.id, itemId))
                } else {
                    await tx.insert(exerciseListItems).values({ listId: id, uuid, ...values })
                }
            }

            await tx.update(exerciseLists).set({ updatedAt: new Date() }).where(eq(exerciseLists.id, id))
        })
    } catch (err) {
        if (err instanceof Refusal) return c.json(err.body, err.status)
        throw err
    }

    return c.json(await itemsResponse(id))
}

app.put('/:id/items', validator('param', idParamSchema), validator('json', itemsBodySchema),
    (c) => putItems(c, c.req.valid('param').id, c.req.valid('json').items))
app.put('/uuid/:uuid/items', validator('param', uuidParamSchema), validator('json', itemsBodySchema),
    async (c) => putItems(c, await listByUuid(c), c.req.valid('json').items))

const appendBodySchema = z.object({
    // Chosen by a client adding the item offline; a retry with it appends nothing more.
    uuid: z.uuid().optional(),
    exerciseId: z.number().int().positive().optional(),
    exerciseUuid: z.uuid().optional(),
}).strict().refine(oneOf('exerciseId', 'exerciseUuid'), { message: 'Give exerciseId or exerciseUuid', path: ['exerciseId'] })

// POST /api/exercise-lists/:id/items — appends one exercise, unprescribed. The "add to list"
// menus use it instead of a replace-all built from a possibly stale copy of the items.
async function appendItem(c: Context<AuthEnv>, id: ListParam, body: z.infer<typeof appendBodySchema>) {
    const user = c.get('user')
    const locale = c.get('locale')
    if (id === undefined) return c.json(notFound(locale), 404)

    const frozen = await computeFrozenListsForUser(user.id, user.role)
    if (frozen.has(id)) {
        return c.json(frozenListResponse(id), 403)
    }

    try {
        await db.transaction(async (tx) => {
            if (!await lockOwnedList(tx, user.id, id)) throw new Refusal(404, notFound(locale))
            if (body.uuid !== undefined) {
                const [existing] = await tx.select({ listId: exerciseListItems.listId }).from(exerciseListItems)
                    .where(eq(exerciseListItems.uuid, body.uuid))
                if (existing?.listId === id) return // A retry: appended the first time.
                if (existing) throw new Refusal(409, UUID_CONFLICT)
            }
            const exerciseId = body.exerciseId ?? (await availableExerciseIds(tx, user.id, [body.exerciseUuid!])).get(body.exerciseUuid!)
            if (exerciseId === undefined || !await exercisesAvailable(tx, user.id, [exerciseId])) {
                throw exerciseNotAvailable(locale)
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

            await tx.insert(exerciseListItems).values({ listId: id, uuid: body.uuid, exerciseId, position: next })
            await tx.update(exerciseLists).set({ updatedAt: new Date() }).where(eq(exerciseLists.id, id))
        })
    } catch (err) {
        if (err instanceof Refusal) return c.json(err.body, err.status)
        throw err
    }

    return c.json(await itemsResponse(id), 201)
}

app.post('/:id/items', validator('param', idParamSchema), validator('json', appendBodySchema),
    (c) => appendItem(c, c.req.valid('param').id, c.req.valid('json')))
app.post('/uuid/:uuid/items', validator('param', uuidParamSchema), validator('json', appendBodySchema),
    async (c) => appendItem(c, await listByUuid(c), c.req.valid('json')))

// DELETE /api/exercise-lists/:id — frozen lists too: deleting one is how the user frees a slot.
async function deleteList(c: Context<AuthEnv>, id: ListParam) {
    const [deleted] = id === undefined ? [] : await db
        .delete(exerciseLists)
        .where(and(eq(exerciseLists.id, id), eq(exerciseLists.userId, c.get('user').id)))
        .returning()

    if (!deleted) {
        return c.json(notFound(c.get('locale')), 404)
    }

    return c.json({ success: true, deletedId: deleted.id, uuid: deleted.uuid })
}

app.delete('/:id', validator('param', idParamSchema), (c) => deleteList(c, c.req.valid('param').id))
app.delete('/uuid/:uuid', validator('param', uuidParamSchema), async (c) => deleteList(c, await listByUuid(c)))

export default app
