import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import db from "../../db/db.js";
import { habits } from '../../db/schema/index.js'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from '../../middleware/auth.js'

// Define the Context Type to include User from middleware
type AuthEnv = {
    Variables: {
        user: any // Replace with proper type import from auth definition
    }
}

const app = new Hono<AuthEnv>()

// Apply Auth Middleware to all routes in this file
app.use('*', requireAuth)

// GET /api/habits
app.get('/', async (c) => {
    const user = c.get('user')

    const result = await db.select()
        .from(habits)
        .where(eq(habits.userId, user.id))
        .orderBy(habits.order, desc(habits.createdAt))

    return c.json(result)
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
        // Validate the JSONB structure if you want, or just accept array
        colorStops: z.array(z.object({
            position: z.number(),
            color: z.tuple([z.number(), z.number(), z.number(), z.number()])
        })).optional(),
        icon: z.string().default('star'),
        order: z.number().int().min(0).default(0),
    })),
    async (c) => {
        const user = c.get('user')
        const body = c.req.valid('json') // Type-safe body from Zod
        const result = await db.insert(habits).values({
            ...body,
            userId: user.id
        }).returning()

        return c.json(result[0], 201)
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
        colorStops: z.array(z.object({
            position: z.number(),
            color: z.tuple([z.number(), z.number(), z.number(), z.number()])
        })).optional(),
        icon: z.string().optional(),
        type: z.enum(['count', 'complex', 'negative', 'timed', 'check']).optional(),
        isAntiHabit: z.boolean().optional(),
        order: z.number().int().min(0).optional(),
    }).strict()),
    async (c) => {



        const user = c.get('user')
        const id = Number(c.req.param('id'))


        const updates = c.req.valid('json')

        const result = await db.update(habits)
            .set(updates)
            .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
            .returning()

        if (result.length === 0) {
            return c.json({ error: "Habit not found" }, 404)
        }

        return c.json(result[0])
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

        const results = await Promise.all(
            items.map(item =>
                db.update(habits)
                    .set({ order: item.order, isAntiHabit: item.isAntiHabit })
                    .where(and(eq(habits.id, item.id), eq(habits.userId, user.id)))
                    .returning()
            )
        )

        return c.json({ success: true, updated: results.flat() })
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
        return c.json({ error: "Habit not found" }, 404)
    }

    return c.json({ success: true, deletedId: id })
})

export default app