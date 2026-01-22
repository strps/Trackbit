import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, inArray, sql, gte, lte, desc, asc } from 'drizzle-orm'
import { requireAuth } from '../../middleware/auth'
import { dayLogs, exerciseLogs, exercisePerformances, exerciseSessions, habits } from '../../db/schema'
import db from '../../db/db'
import { defineCrudSchemas } from '../../lib/utilities/drizzle-crud-schemas'
import { generateCrudRouter } from '../../lib/utilities/crud-router-factory'




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

app.get('/history', async (c) => {
    const user = c.get('user');

    // Query params
    const start = c.req.query('start');       // 'YYYY-MM-DD'
    const end = c.req.query('end');
    const tz = c.req.query('tz') || 'America/Costa_Rica'; // Later: from user profile

    // Define the local day expression once (safe interpolation)
    const localDayExpr = sql<string>`("time_stamp" AT TIME ZONE ${tz})::date`;

    // Optional range filter on the derived local day
    let dayLogWhere;
    if (start || end) {
        const conditions = [];
        if (start) conditions.push(gte(localDayExpr, start));
        if (end) conditions.push(lte(localDayExpr, end));
        dayLogWhere = and(...conditions);
    }

    const habitsWithLogs = await db.query.habits.findMany({
        where: eq(habits.userId, user.id),
        with: {
            dayLogs: {
                where: dayLogWhere,
                // Order using the expression directly (no alias needed here)
                orderBy: desc(localDayExpr),
                // Add localDay to each dayLog object for frontend heatmap use
                extras: {
                    localDay: localDayExpr.as('local_day'),
                },
                with: {
                    exerciseSessions: {
                        with: {
                            exerciseLogs: {
                                with: {
                                    exercisePerformances: {
                                        orderBy: asc(exercisePerformances.createdAt),
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: asc(habits.createdAt),
    });

    return c.json(habitsWithLogs.length > 0 ? habitsWithLogs : []);
});




app.post(
    '/check',
    zValidator(
        'json',
        z.object({
            habitId: z.number(),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
            rating: z.number(),
            timeStamp: z.string()//.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/), // ISO 8601 timestamp
        }).strict()
    ),
    //TODO: check for user id in habit in oreder to make sure the user can only update own.
    async (c) => {
        const { habitId, date, rating, timeStamp } = c.req.valid('json');

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
            await db.insert(dayLogs).values({ habitId, date, rating, timeStamp: new Date(timeStamp) });

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
const dayLogSchemas = defineCrudSchemas(dayLogs, {
    omitFromCreateUpdate: ['createdAt'],
    refine: (schema) =>
        schema.extend({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
            rating: z.number().min(0).max(5),
        }).strict(),
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

const sessionSchemas = defineCrudSchemas(exerciseSessions, {
    omitFromCreateUpdate: ['id', 'createdAt'],
    refine: (schema) =>
        schema.extend({
            timeStamp: z.string()//.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'Timestamp must be in ISO 8601 format'),
        }),

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
    beforeCreate: async (c, data: any) => {
        //Check day log exists  according with habitId and date, if not create it.
        const dayLog = await db
            .select()
            .from(dayLogs)
            .where(and(
                eq(dayLogs.habitId, data.habitId),
                eq(dayLogs.date, data.date!)
            ))
            .limit(1);

        if (dayLog.length === 0) {
            console.log("Day log does not exist for, creating new one");
            await db
                .insert(dayLogs)
                .values({
                    habitId: data.habitId,
                    date: data.date,
                    timeStamp: data.timeStamp && new Date(data.timeStamp)

                })
        }

        return data;
    },
});

app.route('/exercise-sessions', sessionRouter);

//============================================================================================
//--- EXERCISE LOGS ---
//============================================================================================

const exerciseLogsSchemas = defineCrudSchemas(exerciseLogs, {
    omitFromCreateUpdate: ['id', 'createdAt'],
    refine: (schema) =>
        schema.extend({
            exercisePerformances: z.array(
                z.object({
                    reps: z.number().min(0).nullable(),
                    weight: z.number().min(0).nullable(),
                    number: z.number().min(0).nullable(),
                })
            ).optional(),
        }),
});
// TODO: exercise logs should be ordered by createdAt, similar exercise sets
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
            //TODO: this values should be inferred from schema, this should be handeled in the generateCrudRouter
            const body = c.req.valid("json") as any;
            return await db.transaction(async (tx) => {
                // 1. Create the Exercise Log Header
                const logRes = await tx.insert(exerciseLogs).values({
                    exerciseSessionId: body.exerciseSessionId,
                    exerciseId: body.exerciseId
                }).returning();

                const newLogId = logRes[0].id;

                // 2. Prepare Sets
                // If sets provided, use them. If not, create 1 default empty set.
                const setsToInsert = (body.exercisePerformances && body.exercisePerformances.length > 0)
                    ? body.exercisePerformances
                    : [{ reps: 0, weight: 0 }];

                // 3. Insert Sets
                const setRes = await tx.insert(exercisePerformances).values(
                    setsToInsert.map((s: { reps: number, weight: number, number: number }) => ({
                        exerciseLogId: newLogId,
                        number: s.number,
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
//--- EXERCISE PERFORMANCES ---
//============================================================================================

const exercisePerformanceSchemas = defineCrudSchemas(exercisePerformances, {
    omitFromCreateUpdate: ['createdAt'],
});

const exercisePerformancesRouter = generateCrudRouter({
    table: exercisePerformances,
    schemas: exercisePerformanceSchemas,
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

app.route('/exercise-performances', exercisePerformancesRouter);


//============================================================================================
//--- EXERCISE LAPS ---
//============================================================================================


export default app;