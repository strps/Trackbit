import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import db from "../../db/db.js";
import { habits } from '../../db/schema/index.js'
import { DEFAULT_COLOR_STOPS } from '../../db/schema/app/habits.js'
import { eq, and, desc, count, sql } from 'drizzle-orm'
import { requireAuth } from '../../middleware/auth.js'
import { localeMiddleware } from '../../middleware/locale.js'
import { t } from '../../i18n/index.js'
import {
    computeFrozenHabitIds,
    computeFrozenHabitsForUser,
    getEffectiveLimits,
} from '../../lib/user-limits.js'

const HABIT_ORDER_UNIQUE_CONSTRAINT = 'habits_user_anti_order_uq'

// Postgres unique-violation thrown by `node-postgres` carries `code === '23505'`
// and `constraint === '<name>'` on the underlying error.
function isHabitOrderConflict(err: unknown): boolean {
    const e = err as { code?: string; constraint?: string; cause?: unknown }
    if (e?.code === '23505' && e?.constraint === HABIT_ORDER_UNIQUE_CONSTRAINT) return true
    if (e?.cause) return isHabitOrderConflict(e.cause)
    return false
}

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
    zValidator('json', z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(['count', 'complex', 'negative', 'timed', 'check']).default('count'),
        isAntiHabit: z.boolean().default(false),
        weeklyGoal: z.number().int().min(1).max(7).default(5),
        dailyGoal: z.number().default(1),
        colorTheme: z.enum(['green', 'blue', 'orange', 'purple', 'rose', 'fire', 'custom']).optional(),
        // Always persist a non-empty gradient: fall back to the default when omitted.
        // Cast: ColorStop's color is a 3-or-4 tuple union, the schema pins it to rgba(4).
        colorStops: colorStopsSchema.default(DEFAULT_COLOR_STOPS as z.infer<typeof colorStopsSchema>),
        icon: z.string().default('star'),
    })),
    async (c) => {
        const user = c.get('user')
        const body = c.req.valid('json') // Type-safe body from Zod

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
            if (isHabitOrderConflict(err)) {
                return c.json(HABIT_ORDER_CONFLICT_RESPONSE, 409)
            }
            throw err
        }
    }
)

// PUT /api/habits/:id
app.put(
    '/:id',
    zValidator('json', z.object({
        id: z.number().optional(),
        name: z.string().optional(),
        description: z.string().optional().nullable(),
        weeklyGoal: z.number().int().min(1).max(7).default(5),
        dailyGoal: z.number().default(1),
        colorTheme: z.enum(['green', 'blue', 'orange', 'purple', 'rose', 'fire', 'custom']).optional(),
        colorStops: colorStopsSchema.optional(),
        icon: z.string().optional(),
        type: z.enum(['count', 'complex', 'negative', 'timed', 'check']).optional(),
        isAntiHabit: z.boolean().optional(),
        order: z.number().int().min(0).optional(),
    }).strict()),
    async (c) => {



        const user = c.get('user')
        const id = Number(c.req.param('id'))


        const updates = c.req.valid('json')

        const frozen = await computeFrozenHabitsForUser(user.id, user.role)
        if (frozen.has(id)) {
            return c.json({
                error: 'habit_frozen',
                message: 'This habit is frozen because your role limits were reduced. Delete it or another to free a slot.',
            }, 403)
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
            const result = await db.update(habits)
                .set(updates)
                .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
                .returning()

            if (result.length === 0) {
                return c.json({ error: t('errors', 'habit_not_found', c.get('locale')) }, 404)
            }

            return c.json(result[0])
        } catch (err) {
            if (isHabitOrderConflict(err)) {
                return c.json(HABIT_ORDER_CONFLICT_RESPONSE, 409)
            }
            throw err
        }
    }
)

// PATCH /api/habits/reorder — Batch update order + isAntiHabit
app.patch(
    '/reorder',
    zValidator('json', z.object({
        items: z.array(z.object({
            id: z.number(),
            order: z.number().int().min(0),
            isAntiHabit: z.boolean(),
        }))
    })),
    async (c) => {
        const user = c.get('user')
        const { items } = c.req.valid('json')

        const frozen = await computeFrozenHabitsForUser(user.id, user.role)
        const blockedIds = items.filter((it) => frozen.has(it.id)).map((it) => it.id)
        if (blockedIds.length > 0) {
            return c.json({
                error: 'habit_frozen',
                message: 'One or more habits are frozen and cannot be reordered.',
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

// DELETE /api/habits/:id
app.delete('/:id', async (c) => {
    const user = c.get('user')
    const id = Number(c.req.param('id'))

    const result = await db.delete(habits)
        .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
        .returning()

    if (result.length === 0) {
        return c.json({ error: t('errors', 'habit_not_found', c.get('locale')) }, 404)
    }

    return c.json({ success: true, deletedId: id })
})

export default app