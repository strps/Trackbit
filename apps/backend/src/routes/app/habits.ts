import { Hono, type Context } from 'hono'
import { validator } from '../../lib/validator.js'
import { z } from 'zod'
import db from "../../db/db.js";
import { habits } from '../../db/schema/index.js'
import { DEFAULT_COLOR_STOPS } from '../../db/schema/app/habits.js'
import { COLOR_THEMES, HABIT_ICON_IDS } from '@trackbit/types'
import { eq, and, desc, count, sql, inArray } from 'drizzle-orm'
import { requireAuth } from '../../middleware/auth.js'
import { localeMiddleware } from '../../middleware/locale.js'
import { t } from '../../i18n/index.js'
import { frozenHabitException } from '../../lib/frozen-errors.js'
import { isUniqueViolation } from '../../lib/db-errors.js'
import { createdBefore, habitIdByUuid, oneOf, uuidParamSchema } from '../../lib/uuid-refs.js'
import {
    computeFrozenHabitIds,
    computeFrozenHabitsForUser,
    getEffectiveLimits,
} from '../../lib/user-limits.js'

const HABIT_ORDER_UNIQUE_CONSTRAINT = 'habits_user_anti_order_uq'

const isHabitOrderConflict = (err: unknown) => isUniqueViolation(err, HABIT_ORDER_UNIQUE_CONSTRAINT)

/** The habit a create with [uuid] already made (a retry), if any; see lib/uuid-refs.ts. */
const habitCreatedBefore = (uuid: string | undefined, userId: string) =>
    createdBefore(uuid, (u) => db.select().from(habits).where(eq(habits.uuid, u)), userId)

const HABIT_ORDER_CONFLICT_RESPONSE = {
    error: 'habit_order_conflict',
    message: 'Another habit already uses this order.',
} as const

// A gradient must have at least one stop — an empty array crashes the frontend
// color renderer (`stops[0]` is undefined). Shared by create and update.
const colorStopsSchema = z.array(z.object({
    position: z.number(),
    color: z.tuple([z.number(), z.number(), z.number(), z.number()]),
})).min(1)

// The habit form's rules (web and Android), enforced here so no client can store more.
// A timed habit's daily goal is minutes, capped at a day.
const nameSchema = z.string().trim().min(3).max(50)
const dailyGoalSchema = z.number().int().min(1).max(1440)
const habitTypeSchema = z.enum(['count', 'complex', 'negative', 'timed', 'check'])

// Mirrors the `habits_complex_not_anti` check: a structured session has no slip to count.
const isAllowedAntiHabit = (type: string, isAntiHabit: boolean) => !(isAntiHabit && type === 'complex')
const ANTI_HABIT_NOT_ALLOWED_RESPONSE = {
    error: 'anti_habit_not_allowed',
    message: 'Structured sessions cannot be anti-habits.',
} as const

// Define the Context Type to include User from middleware
type AuthEnv = {
    Variables: {
        user: any // Replace with proper type import from auth definition
        locale: string
    }
}

const app = new Hono<AuthEnv>()

// Apply Auth Middleware to all routes in this file
app.use('*', requireAuth)
app.use('*', localeMiddleware)

// GET /api/habits
app.get('/', async (c) => {
    const user = c.get('user')

    const result = await db.select()
        .from(habits)
        .where(eq(habits.userId, user.id))
        .orderBy(habits.order, desc(habits.createdAt))

    const limits = await getEffectiveLimits(user.role)
    const frozen = computeFrozenHabitIds(result, limits)
    const annotated = result.map((row) => ({ ...row, frozen: frozen.has(row.id) }))

    return c.json(annotated)
})

// POST /api/habits
app.post(
    '/',
    validator('json', z.object({
        // Chosen by a client creating the habit offline; a retry with it returns the same habit.
        uuid: z.uuid().optional(),
        name: nameSchema,
        description: z.string().optional(),
        type: habitTypeSchema.default('count'),
        isAntiHabit: z.boolean().default(false),
        weeklyGoal: z.number().int().min(1).max(7).default(5),
        dailyGoal: dailyGoalSchema.default(1),
        colorTheme: z.enum(COLOR_THEMES).optional(),
        // Always persist a non-empty gradient: fall back to the default when omitted.
        // Cast: ColorStop's color is a 3-or-4 tuple union, the schema pins it to rgba(4).
        colorStops: colorStopsSchema.default(DEFAULT_COLOR_STOPS as z.infer<typeof colorStopsSchema>),
        icon: z.enum(HABIT_ICON_IDS).default('star'),
    }).refine((body) => isAllowedAntiHabit(body.type, body.isAntiHabit), {
        message: ANTI_HABIT_NOT_ALLOWED_RESPONSE.message,
        path: ['isAntiHabit'],
    })),
    async (c) => {
        const user = c.get('user')
        const body = c.req.valid('json') // Type-safe body from Zod

        // A retried create answers with what it made, before the limits: at the cap it would
        // otherwise refuse the habit it already created.
        const existing = await habitCreatedBefore(body.uuid, user.id)
        if (existing) return c.json(existing, 201)

        const limits = await getEffectiveLimits(user.role)
        if (limits) {
            if (!limits.allowedHabitTypes.includes(body.type)) {
                return c.json({
                    error: 'habit_type_not_allowed',
                    message: `Habit type "${body.type}" is not allowed for your role.`,
                    allowedHabitTypes: limits.allowedHabitTypes,
                }, 403)
            }

            if (limits.maxHabits != null) {
                const [{ value: existingCount }] = await db
                    .select({ value: count() })
                    .from(habits)
                    .where(eq(habits.userId, user.id))

                if (existingCount >= limits.maxHabits) {
                    return c.json({
                        error: 'habit_limit_reached',
                        message: `You have reached the maximum of ${limits.maxHabits} habits for your role.`,
                        maxHabits: limits.maxHabits,
                    }, 403)
                }
            }
        }

        // Assign the next order slot server-side, scoped to the unique constraint's
        // tuple (userId, isAntiHabit). Deletes leave gaps, so MAX+1 never collides
        // with a surviving row. The client-supplied order is ignored.
        const [{ nextOrder }] = await db
            .select({ nextOrder: sql<number>`COALESCE(MAX(${habits.order}) + 1, 0)` })
            .from(habits)
            .where(and(eq(habits.userId, user.id), eq(habits.isAntiHabit, body.isAntiHabit)))

        try {
            const result = await db.insert(habits).values({
                ...body,
                order: nextOrder,
                userId: user.id
            }).returning()

            return c.json(result[0], 201)
        } catch (err) {
            // The same create ran concurrently and won.
            if (isUniqueViolation(err, 'habits_uuid_unique')) {
                const won = await habitCreatedBefore(body.uuid, user.id)
                if (won) return c.json(won, 201)
            }
            if (isHabitOrderConflict(err)) {
                return c.json(HABIT_ORDER_CONFLICT_RESPONSE, 409)
            }
            throw err
        }
    }
)

const habitUpdateSchema = z.object({
    id: z.number().optional(),
    name: nameSchema.optional(),
    description: z.string().optional().nullable(),
    weeklyGoal: z.number().int().min(1).max(7).optional(),
    dailyGoal: dailyGoalSchema.optional(),
    colorTheme: z.enum(COLOR_THEMES).optional(),
    colorStops: colorStopsSchema.optional(),
    icon: z.enum(HABIT_ICON_IDS).optional(),
    type: habitTypeSchema.optional(),
    isAntiHabit: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
}).strict()

/**
 * Applies the fields given and nothing else, so concurrent edits of different fields (web and an
 * offline app) both survive: last write wins per field.
 */
async function updateHabit(c: Context<AuthEnv>, id: number, body: z.infer<typeof habitUpdateSchema>) {
    const user = c.get('user')
    const { id: _bodyId, ...updates } = body

    const frozen = await computeFrozenHabitsForUser(user.id, user.role)
    if (frozen.has(id)) {
        throw frozenHabitException(id)
    }

    if (updates.type) {
        const limits = await getEffectiveLimits(user.role)
        if (limits && !limits.allowedHabitTypes.includes(updates.type)) {
            return c.json({
                error: 'habit_type_not_allowed',
                message: `Habit type "${updates.type}" is not allowed for your role.`,
                allowedHabitTypes: limits.allowedHabitTypes,
            }, 403)
        }
    }

    try {
        const result = await db.transaction(async (tx) => {
            const [current] = await tx.select({ type: habits.type, isAntiHabit: habits.isAntiHabit })
                .from(habits)
                .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
                .for('update')
            if (!current) return 'not_found' as const

            const isAntiHabit = updates.isAntiHabit ?? current.isAntiHabit
            if (!isAllowedAntiHabit(updates.type ?? current.type, isAntiHabit)) return 'anti_not_allowed' as const

            // Moving between habits and anti-habits takes the next slot of the other group,
            // as create does; keeping the old order would collide with a habit already there.
            let order = updates.order
            if (order === undefined && isAntiHabit !== current.isAntiHabit) {
                const [{ nextOrder }] = await tx
                    .select({ nextOrder: sql<number>`COALESCE(MAX(${habits.order}) + 1, 0)` })
                    .from(habits)
                    .where(and(eq(habits.userId, user.id), eq(habits.isAntiHabit, isAntiHabit)))
                order = nextOrder
            }

            const [row] = await tx.update(habits)
                .set({ ...updates, ...(order !== undefined && { order }) })
                .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
                .returning()
            return row
        })

        if (result === 'not_found') return habitNotFound(c)
        if (result === 'anti_not_allowed') {
            return c.json(ANTI_HABIT_NOT_ALLOWED_RESPONSE, 400)
        }

        return c.json(result)
    } catch (err) {
        if (isHabitOrderConflict(err)) {
            return c.json(HABIT_ORDER_CONFLICT_RESPONSE, 409)
        }
        throw err
    }
}

function habitNotFound(c: Context<AuthEnv>) {
    return c.json({ error: t('errors', 'habit_not_found', c.get('locale')) }, 404)
}

// PUT /api/habits/:id
app.put('/:id', validator('json', habitUpdateSchema), (c) => updateHabit(c, Number(c.req.param('id')), c.req.valid('json')))

// PUT /api/habits/uuid/:uuid
app.put('/uuid/:uuid', validator('param', uuidParamSchema), validator('json', habitUpdateSchema), async (c) => {
    const id = await habitIdByUuid(c.get('user').id, c.req.valid('param').uuid)
    return id === undefined ? habitNotFound(c) : updateHabit(c, id, c.req.valid('json'))
})

// PATCH /api/habits/reorder — Batch update order + isAntiHabit
app.patch(
    '/reorder',
    validator('json', z.object({
        // Each habit by id or by uuid.
        items: z.array(z.object({
            id: z.number().optional(),
            uuid: z.uuid().optional(),
            order: z.number().int().min(0),
            isAntiHabit: z.boolean(),
        }).refine(oneOf('id', 'uuid'), { message: 'Give id or uuid', path: ['id'] }))
    })),
    async (c) => {
        const user = c.get('user')
        const given = c.req.valid('json').items

        // Uuids become ids. One that names none of the user's habits (deleted meanwhile) is
        // skipped, as an unknown id always was.
        const uuids = given.flatMap((it) => it.uuid === undefined ? [] : [it.uuid])
        const idByUuid = new Map(uuids.length === 0 ? [] : (await db.select({ id: habits.id, uuid: habits.uuid })
            .from(habits)
            .where(and(eq(habits.userId, user.id), inArray(habits.uuid, uuids)))).map((row) => [row.uuid, row.id]))
        const items = given.flatMap(({ uuid, id, ...item }) => {
            const resolved = uuid === undefined ? id : idByUuid.get(uuid)
            return resolved === undefined ? [] : [{ ...item, id: resolved }]
        })

        const rows = items.length === 0 ? [] : await db.select({ id: habits.id, type: habits.type, isAntiHabit: habits.isAntiHabit })
            .from(habits)
            .where(and(eq(habits.userId, user.id), inArray(habits.id, items.map((it) => it.id))))
        const current = new Map(rows.map((row) => [row.id, row]))
        if (items.some((it) => !isAllowedAntiHabit(current.get(it.id)?.type ?? 'count', it.isAntiHabit))) {
            return c.json(ANTI_HABIT_NOT_ALLOWED_RESPONSE, 400)
        }

        // A frozen habit can't change group, but it still shifts when others move around it:
        // refusing that would make the whole list unsortable while any habit is frozen.
        const frozen = await computeFrozenHabitsForUser(user.id, user.role)
        const blockedIds = items
            .filter((it) => frozen.has(it.id) && it.isAntiHabit !== current.get(it.id)?.isAntiHabit)
            .map((it) => it.id)
        if (blockedIds.length > 0) {
            return c.json({
                error: 'habit_frozen',
                message: 'One or more habits are frozen and cannot change group.',
                frozenIds: blockedIds,
            }, 403)
        }

        try {
            // Two-phase write so no intermediate state ever violates the unique
            // constraint on (userId, isAntiHabit, order) — this keeps reorder correct
            // whether or not the constraint is DEFERRABLE in the target database.
            // Phase 1 parks every row in a temporary range (final orders are 0..n-1,
            // so a large offset can never collide); phase 2 sets the final orders.
            const TEMP_ORDER_OFFSET = 1_000_000
            const results = await db.transaction(async (tx) => {
                await Promise.all(
                    items.map(item =>
                        tx.update(habits)
                            .set({ order: TEMP_ORDER_OFFSET + item.order, isAntiHabit: item.isAntiHabit })
                            .where(and(eq(habits.id, item.id), eq(habits.userId, user.id)))
                    )
                )

                return Promise.all(
                    items.map(item =>
                        tx.update(habits)
                            .set({ order: item.order })
                            .where(and(eq(habits.id, item.id), eq(habits.userId, user.id)))
                            .returning()
                    )
                )
            })

            return c.json({ success: true, updated: results.flat() })
        } catch (err) {
            if (isHabitOrderConflict(err)) {
                return c.json(HABIT_ORDER_CONFLICT_RESPONSE, 409)
            }
            throw err
        }
    }
)

/** Deletes the habit with its logs and sessions (cascade). */
async function deleteHabit(c: Context<AuthEnv>, id: number) {
    const user = c.get('user')
    const result = await db.delete(habits)
        .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
        .returning()

    if (result.length === 0) return habitNotFound(c)

    return c.json({ success: true, deletedId: id, uuid: result[0].uuid })
}

// DELETE /api/habits/:id
app.delete('/:id', (c) => deleteHabit(c, Number(c.req.param('id'))))

// DELETE /api/habits/uuid/:uuid
app.delete('/uuid/:uuid', validator('param', uuidParamSchema), async (c) => {
    const id = await habitIdByUuid(c.get('user').id, c.req.valid('param').uuid)
    return id === undefined ? habitNotFound(c) : deleteHabit(c, id)
})

export default app