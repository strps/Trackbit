import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import db from '../db/db'
import { dayLogs, exerciseSets, habits } from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'

type AuthEnv = {
    Variables: {
        user: any
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAuth)

// GET /api/logs/history - Fetch all logs for the user (for Heatmap)
app.get('/history', async (c) => {
    const user = c.get('user')

    // 1. Get all user's habit IDs
    const userHabits = await db.select({ id: habits.id }).from(habits).where(eq(habits.userId, user.id))

    if (userHabits.length === 0) return c.json([])

    // 2. Fetch logs for these habits
    const logs = await db.query.dayLogs.findMany({
        where: (logs, { inArray }) => inArray(logs.habitId, userHabits.map(h => h.id)),
        columns: {
            id: true,
            habitId: true,
            date: true,
            rating: true,
            notes: true
        },
        with: {
            sets: true // Include sets for workout summaries
        }
    })

    return c.json(logs)
})

// POST /api/logs/check - For Simple & Negative Habits (Counter/Toggle)
app.post(
    '/check',
    zValidator('json', z.object({
        habitId: z.number(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
        value: z.number(),
    })),
    async (c) => {
        const { habitId, date, value } = c.req.valid('json')

        // Check if log exists
        const existing = await db.query.dayLogs.findFirst({
            where: (logs, { eq, and }) => and(eq(logs.habitId, habitId), eq(logs.date, date))
        })

        if (existing) {
            // Update
            await db.update(dayLogs).set({ value }).where(eq(dayLogs.id, existing.id))
            return c.json({ success: true, id: existing.id })
        } else {
            // Insert
            const res = await db.insert(dayLogs).values({ habitId, date, value }).returning()
            return c.json({ success: true, id: res[0].id })
        }
    }
)

// POST /api/logs/workout - For Complex/Gym Habits
app.post(
    '/workout',
    zValidator('json', z.object({
        id: z.number().optional(), // If provided, it's an update
        habitId: z.number(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        notes: z.string().optional(),
        rating: z.number().optional(),
        sets: z.array(z.object({
            exerciseId: z.number(),
            setNumber: z.number(),
            reps: z.number().optional(),
            weight: z.number().optional(),
            weightUnit: z.string().default('kg'),
            distance: z.number().optional(),
            duration: z.number().optional()
        }))
    })),
    async (c) => {
        const body = c.req.valid('json')
        const { habitId, date, notes, rating, sets } = body
        let logId = body.id

        // 1. Create or Update Header
        if (logId) {
            await db.update(dayLogs).set({ notes, rating }).where(eq(dayLogs.id, logId))
            // For MVP simplicity: delete old sets and re-insert new ones
            await db.delete(exerciseSets).where(eq(exerciseSets.habitLogId, logId))
        } else {
            const res = await db.insert(dayLogs).values({
                habitId,
                date,
                notes,
                rating,
                value: 1 // Marks the habit as "done" for existence check
            }).returning()
            logId = res[0].id
        }

        // 2. Insert Sets
        if (sets.length > 0 && logId) {
            await db.insert(exerciseSets).values(sets.map(s => ({
                habitLogId: logId!,
                exerciseId: s.exerciseId,
                setNumber: s.setNumber,
                reps: s.reps,
                weight: s.weight,
                weightUnit: s.weightUnit,
                distance: s.distance,
                duration: s.duration
            })))
        }

        return c.json({ success: true, logId })
    }
)

export default app