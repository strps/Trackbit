import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import db from '@trackbit/db'
import { dayLogs, exerciseLogs, exerciseSessions, exerciseSets, habits } from '@trackbit/db'
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


    const habitsWithLogs = await db.query.habits.findMany({
        where: (habits, { eq }) => eq(habits.userId, user.id),
        with: {
            dayLogs: {
                with: {
                    exerciseSessions: {
                        with: {
                            exerciseLogs: {
                                with: {
                                    exerciseSets: true  //TODO: we need to order the sets according to createdAt
                                }
                            }
                        }
                    }
                }
            }
        }

    })

    return c.json(habitsWithLogs)
})


app.post(
    '/check',
    zValidator(
        'json',
        z.object({
            habitId: z.number(),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
            rating: z.number(),
        })
    ),
    //TODO: check for user id in habit in oreder to make sure the user can only update own.
    async (c) => {
        const { habitId, date, rating } = c.req.valid('json');

        // Check if log exists
        const existing = await db.query.dayLogs.findFirst({
            where: (logs, { eq, and }) =>
                and(eq(logs.habitId, habitId), eq(logs.date, date)),
        });

        if (existing) {
            // Update using composite key
            await db
                .update(dayLogs)
                .set({ rating })
                .where(
                    and(eq(dayLogs.habitId, habitId), eq(dayLogs.date, date))
                );

            return c.json({
                success: true,
                habitId,
                date,
            });
        } else {
            // Insert new log
            await db.insert(dayLogs).values({ habitId, date, rating });

            return c.json({
                success: true,
                habitId,
                date,
            });
        }
    }
);


// --- GRANULAR WORKOUT LOGGING ---

// 1. Ensure Session Exists (Call this when starting a workout)
app.post('/exercise-sessions', zValidator('json', z.object({
    habitId: z.number(),
    date: z.string(),
})), async (c) => {
    const { habitId, date } = c.req.valid('json');

    return await db.transaction(async (tx) => {
        // Ensure DayLog Wrapper
        const existingDayLog = await tx.query.dayLogs.findFirst({
            where: (l, { and, eq }) => and(eq(l.habitId, habitId), eq(l.date, date))
        });
        if (!existingDayLog) {
            const hres = await tx.insert(dayLogs).values({ habitId, date }).returning();
        }
        const hres = existingDayLog

        const res = await tx.insert(exerciseSessions).values({ habitId, date }).returning();

        return c.json(res[0])
    });
});







































// 2. Add/Remove Exercises
app.post('/exercise-logs', zValidator('json', z.object({
    sessionId: z.number(),
    exerciseId: z.number(),
})), async (c) => {
    const body = c.req.valid('json');
    const res = await db.insert(exerciseLogs).values({
        exerciseSessionId: body.sessionId,
        exerciseId: body.exerciseId
    }).returning();
    return c.json(res[0]);
});

app.post(
    '/exercise-log',
    zValidator('json', z.object({
        sessionId: z.number(),
        exerciseId: z.number(),
        // New: Accepts an array of sets immediately
        exerciseSets: z.array(z.object({
            reps: z.number(),
            weight: z.number(),
        })).optional(),
    })),
    async (c) => {
        const body = c.req.valid('json');

        return await db.transaction(async (tx) => {
            // 1. Create the Exercise Log Header
            const logRes = await tx.insert(exerciseLogs).values({
                exerciseSessionId: body.sessionId,
                exerciseId: body.exerciseId
            }).returning();

            const newLogId = logRes[0].id;

            // 2. Prepare Sets
            // If sets provided, use them. If not, create 1 default empty set.
            const setsToInsert = (body.exerciseSets && body.exerciseSets.length > 0)
                ? body.exerciseSets
                : [{ reps: 0, weight: 0 }];

            // 3. Insert Sets
            const setRes = await tx.insert(exerciseSets).values(
                setsToInsert.map(s => ({
                    exerciseLogId: newLogId,
                    reps: s.reps,
                    weight: s.weight,
                }))
            ).returning();

            // 4. Return combined structure
            return c.json({
                ...logRes[0],
                sets: setRes
            });
        });
    }
);


app.delete('/exercise-logs/:id', async (c) => {
    const id = Number(c.req.param('id'));
    await db.delete(exerciseLogs).where(eq(exerciseLogs.id, id));
    return c.json({ success: true, id });
});

// 3. Add/Update/Remove Sets
app.post('/exercise-set', zValidator('json', z.object({
    id: z.number().optional(), // If present, update
    exerciseLogId: z.number(),
    reps: z.number(),
    weight: z.number(),
})), async (c) => {
    const body = c.req.valid('json');

    if (body.id) {
        const res = await db.update(exerciseSets)
            .set({ reps: body.reps, weight: body.weight })
            .where(eq(exerciseSets.id, body.id))
            .returning();
        return c.json(res[0]);
    } else {
        const res = await db.insert(exerciseSets)
            .values({
                exerciseLogId: body.exerciseLogId,
                reps: body.reps,
                weight: body.weight
            })
            .returning();
        return c.json(res[0]);
    }
});

app.delete('/exercise-set/:id', async (c) => {
    const id = Number(c.req.param('id'));
    await db.delete(exerciseSets).where(eq(exerciseSets.id, id));
    return c.json({ success: true, id });
});

export default app;