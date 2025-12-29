import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import db from "../db/db.js";
import { dayLogs, exerciseLogs, exerciseSessions, exerciseSets, habits } from "../db/schema/index.js"
import { eq, and, inArray } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { generateValidationCrudSchemas } from '../lib/generateValidationCrudSchemas.js';
import { generateCrudRouter } from '../lib/generateCrudRouter.js';

type AuthEnv = {
    Variables: {
        user: any
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAuth)

//============================================================================================
//--- HISTORY ROUTE ---
//============================================================================================

// Zod Schemas for DayLogs
// GET /api/tracker/history - Fetch all logs for the user (for Heatmap)
app.get('/history', async (c) => {
    const user = c.get('user')

    // 1. Get all user's habit IDs
    const userHabits = await db.select({ id: habits.id }).from(habits).where(eq(habits.userId, user.id))

    if (userHabits.length === 0) return c.json([])


    const habitsWithLogs = await db.query.habits.findMany({
        where: (habits) => eq(habits.userId, user.id),
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
            where: (logs) =>
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



//============================================================================================
//--- DAY LOGS ROUTER (CRUD) ---
//============================================================================================

// Zod Schemas for DayLogs
const dayLogSchemas = generateValidationCrudSchemas(dayLogs, {
    omitFromCreateUpdate: ['createdAt'],
    refine: (schema) =>
        schema.extend({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
            rating: z.number().min(0).max(5),
        }),
});
//DayLogs Router


const dayLogsRouter = generateCrudRouter({
    table: dayLogs,
    schemas: dayLogSchemas,
    primaryKeyFields: ['habitId', 'date'], // Composite PK
    // Enforce ownership: log belongs to a habit owned by the user
    ownershipCheck: async (user, log) => {
        const habit = await db.query.habits.findFirst({
            where: (h) => eq(h.id, log.habitId)
        });
        return habit?.userId === user.id;
    }
});

app.route('/day-logs', dayLogsRouter);


//============================================================================================
//--- EXERCISE SESSIONS ---
//============================================================================================

const sessionSchemas = generateValidationCrudSchemas(exerciseSessions, {
    omitFromCreateUpdate: ['id', 'createdAt'],

});

const sessionRouter = generateCrudRouter({
    table: exerciseSessions,
    schemas: sessionSchemas,
    primaryKeyFields: ['id'],
    // Enforce ownership: session belongs to a dayLog of a habit owned by the user
    ownershipCheck: async (user, record) => {

        const habit = await db
            .select()
            .from(habits)
            .where(eq(habits.id, record.habitId))
            .limit(1);


        return habit.length > 0 && habit[0].userId === user.id;
    },
    beforeCreate: async (c, data) => {
        //Check day log exists  according with habitId and date, if not create it.

        const dayLog = await db
            .select()
            .from(dayLogs)
            .where(and(
                eq(dayLogs.habitId, data.habitId),
                eq(dayLogs.date, data.date)
            ))
            .limit(1);

        if (dayLog.length === 0) {
            console.log("Day log does not exist for, creating new one");
            await db
                .insert(dayLogs)
                .values({
                    habitId: data.habitId,
                    date: data.date
                })
        }

        return data;
    },
});

app.route('/exercise-sessions', sessionRouter);

//============================================================================================
//--- EXERCISE LOGS ---
//============================================================================================

const exerciseLogsSchemas = generateValidationCrudSchemas(exerciseLogs, {
    omitFromCreateUpdate: ['id', 'createdAt'],
    refine: (schema) =>
        schema.extend({
            exerciseSets: z.array(
                z.object({
                    reps: z.number().min(0),
                    weight: z.number().min(0),
                })
            ).optional(),
        }),
});

const exerciseLogsRouter = generateCrudRouter({
    table: exerciseLogs,
    schemas: exerciseLogsSchemas,
    primaryKeyFields: ['id'],
    // Enforce ownership: log belongs to a session of a dayLog of a habit owned by the user

    ownershipCheck: async (user, record) => {
        //TODO: optimize with joins, currently 3 queries per check, it can be just one.
        const session = await db
            .select()
            .from(exerciseSessions)
            .where(eq(exerciseSessions.id, record.exerciseSessionId))
            .limit(1);

        if (session.length === 0) return false;

        const habit = await db
            .select()
            .from(habits)
            .where(eq(habits.id, session[0].habitId))
            .limit(1);

        return habit.length > 0 && habit[0].userId === user.id;
    },

    overrides: {
        create: async (c) => {
            const body = c.req.valid("json");
            console.log("Creating exercise log with body:", body);
            return await db.transaction(async (tx) => {
                // 1. Create the Exercise Log Header
                const logRes = await tx.insert(exerciseLogs).values({
                    exerciseSessionId: body.exerciseSessionId,
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
        },
    }

});

app.route('/exercise-logs', exerciseLogsRouter);

//============================================================================================
//--- EXERCISE SETS ---
//============================================================================================

const exerciseSetSchemas = generateValidationCrudSchemas(exerciseSets, {
    omitFromCreateUpdate: ['createdAt'],
});

const exerciseSetsRouter = generateCrudRouter({
    table: exerciseSets,
    schemas: exerciseSetSchemas,
    primaryKeyFields: ['id'],
    // Enforce ownership: set belongs to a log of a session of a dayLog of a habit owned by the user
    ownershipCheck: async (user, record) => {
        //TODO: optimize with joins, currently 3 queries per check, it can be just one.
        const log = await db
            .select()
            .from(exerciseLogs)
            .where(eq(exerciseLogs.id, record.exerciseLogId))
            .limit(1);

        if (log.length === 0) return false;

        const session = await db
            .select()
            .from(exerciseSessions)
            .where(eq(exerciseSessions.id, log[0].exerciseSessionId))
            .limit(1);

        if (session.length === 0) return false;

        const habit = await db
            .select()
            .from(habits)
            .where(eq(habits.id, session[0].habitId))
            .limit(1);


        return habit.length > 0 && habit[0].userId === user.id;
    },
});

app.route('/exercise-sets', exerciseSetsRouter);





export default app;