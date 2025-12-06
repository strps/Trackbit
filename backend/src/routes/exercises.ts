import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import db from '../db/db'
import { exercises } from '../db/schema'
import { eq, or, isNull } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'

type AuthEnv = {
    Variables: {
        user: any // In a real app, import { User } from better-auth types
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAuth)

// GET /api/exercises - List Available Exercises
app.get('/', async (c) => {
    const user = c.get('user')

    // Fetch "System Defaults" (userId is NULL) OR "My Custom Exercises"
    const result = await db.select().from(exercises).where(
        or(
            isNull(exercises.userId),
            eq(exercises.userId, user.id)
        )
    )
    return c.json(result)
})

// POST /api/exercises - Create Custom Exercise
app.post(
    '/',
    zValidator('json', z.object({
        name: z.string().min(1),
        category: z.enum(['strength', 'cardio', 'flexibility']).default('strength'),
        muscleGroup: z.string().optional()
    })),
    async (c) => {
        const user = c.get('user')
        const body = c.req.valid('json')

        const result = await db.insert(exercises).values({
            name: body.name,
            category: body.category,
            muscleGroup: body.muscleGroup,
            userId: user.id // Mark as custom
        }).returning()

        return c.json(result[0], 201)
    }
)

export default app