import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import db from '@trackbit/db'
import { habits } from '../../../../packages/db/src/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'

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
        .orderBy(desc(habits.createdAt))

    return c.json(result)
})

// POST /api/habits
app.post(
    '/',
    zValidator('json', z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(['simple', 'complex', 'negative']).default('simple'),
        goal: z.number().int().min(1).max(7).default(5),
        dailyGoal: z.number().default(1),
        // Validate the JSONB structure if you want, or just accept array
        colorStops: z.array(z.object({
            position: z.number(),
            color: z.tuple([z.number(), z.number(), z.number()])
        })).optional(),
        icon: z.string().default('star'),
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
        name: z.string().optional(),
        description: z.string().optional(),
        goal: z.number().optional(),
        colorStops: z.any().optional(), // Simplify validation for now
        icon: z.string().optional(),
        type: z.enum(['simple', 'complex', 'negative']).optional(),
    })),
    async (c) => {



        const user = c.get('user')
        const id = Number(c.req.param('id'))

        console.log(c.req.valid('json'))


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