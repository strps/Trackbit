import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import db from '../db/db'
import { exerciseLogs, exercises, exerciseSets } from '../db/schema'
import { eq, or, isNull, sql, and } from 'drizzle-orm'
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

    //Query exercise exercises with the lastest set.

    const latestSetSubquery = db.$with("latest_sets").as(
        db.select({
            exerciseId: sql<number>`el.exercise_id`.as('exerciseId'),
            setId: sql<number>`es.id`.as('setId'),
            weight: sql<number | null>`es.weight`.as('weight'),
            reps: sql<number | null>`es.reps`.as('reps'),
            createdAt: sql<string | null>`es.created_at`.as('createdAt'),
            rowNumber: sql<number>`row_number() over (partition by el.exercise_id order by es.created_at desc)`.as('row_number'),
        })
            .from(sql`${exerciseLogs} el`)
            .leftJoin(sql`${exerciseSets} es`, sql`es.exercise_log_id = el.id`)
            .where(sql`es.id IS NOT NULL`)  // Optional: exclude rows without sets if desired
    );

    // Main query filters to only the latest (row_number = 1)
    const result = await db
        .with(latestSetSubquery)
        .select({
            id: exercises.id,
            name: exercises.name,
            category: exercises.category,
            muscleGroup: exercises.muscleGroup,
            defaultWeightUnit: exercises.defaultWeightUnit,
            defaultDistanceUnit: exercises.defaultDistanceUnit,

            lastSetId: latestSetSubquery.setId,
            lastSetWeight: latestSetSubquery.weight,
            lastSetReps: latestSetSubquery.reps,
            lastSetCreatedAt: latestSetSubquery.createdAt,
        })
        .from(exercises)
        .leftJoin(
            latestSetSubquery,
            and(
                eq(latestSetSubquery.exerciseId, exercises.id),
                eq(latestSetSubquery.rowNumber, 1)
            )
        )
        .where(or(isNull(exercises.userId), eq(exercises.userId, user.id)));

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