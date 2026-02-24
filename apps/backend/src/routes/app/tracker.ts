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
        orderBy: [asc(habits.order), asc(habits.createdAt)],
    });

    return c.json(habitsWithLogs.length > 0 ? habitsWithLogs : []);
});




app.post(
    '/check',
    zValidator(
        'json',
        z.object({
            habitId: z.number(),
            rating: z.number(),
            timeStamp: z.string(),
        }).strict()
    ),
    //TODO: check for user id in habit in order to make sure the user can only update own.
    async (c) => {
        const { habitId, rating, timeStamp } = c.req.valid('json');
        const tz = c.req.query('tz') || 'America/Costa_Rica';

        // Derive the local day from the provided timestamp
        const localDayExpr = sql<string>`(${timeStamp}::timestamptz AT TIME ZONE ${tz})::date`;

        // Check if log exists for this habit on the same local day
        const existing = await db
            .select({ id: dayLogs.id })
            .from(dayLogs)
            .where(
                and(
                    eq(dayLogs.habitId, habitId),
                    sql`(${dayLogs.timeStamp} AT TIME ZONE ${tz})::date = ${localDayExpr}`
                )
            )
            .limit(1);

        if (existing.length > 0) {
            // Update existing
            await db
                .update(dayLogs)
                .set({ rating })
                .where(eq(dayLogs.id, existing[0].id));

            return c.json({
                success: true,
                id: existing[0].id,
                habitId,
            });
        } else {
            // Insert new log
            const [newLog] = await db.insert(dayLogs).values({
                habitId,
                rating,
                timeStamp: new Date(timeStamp),
            }).returning({ id: dayLogs.id });

            return c.json({
                success: true,
                id: newLog.id,
                habitId,
            });
        }
    }
);



//============================================================================================
//--- DAY LOGS ROUTER (CRUD) ---
//============================================================================================

// Zod Schemas for DayLogs
const dayLogSchemas = defineCrudSchemas(dayLogs, {
    omitFromCreateUpdate: ['id', 'createdAt'],
    refine: (schema) =>
        schema.extend({
            timeStamp: z.coerce.date(),
        }),
});
//DayLogs Router


const dayLogsRouter = generateCrudRouter({
    table: dayLogs,
    schemas: dayLogSchemas,
    primaryKeyFields: ['id'],
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
});

const sessionRouter = generateCrudRouter({
    table: exerciseSessions,
    schemas: sessionSchemas,
    primaryKeyFields: ['id'],
    // Enforce ownership: session belongs to a dayLog of a habit owned by the user

    ownershipCheck: async (user, record) => {
        const dayLog = await db
            .select()
            .from(dayLogs)
            .where(eq(dayLogs.id, record.dayLogId))
            .limit(1);

        if (dayLog.length === 0) return false;

        const habit = await db
            .select()
            .from(habits)
            .where(eq(habits.id, dayLog[0].habitId))
            .limit(1);

        return habit.length > 0 && habit[0].userId === user.id;
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

        const dayLog = await db
            .select()
            .from(dayLogs)
            .where(eq(dayLogs.id, session[0].dayLogId))
            .limit(1);

        if (dayLog.length === 0) return false;

        const habit = await db
            .select()
            .from(habits)
            .where(eq(habits.id, dayLog[0].habitId))
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

        const dayLog = await db
            .select()
            .from(dayLogs)
            .where(eq(dayLogs.id, session[0].dayLogId))
            .limit(1);

        if (dayLog.length === 0) return false;

        const habit = await db
            .select()
            .from(habits)
            .where(eq(habits.id, dayLog[0].habitId))
            .limit(1);


        return habit.length > 0 && habit[0].userId === user.id;
    },
});

app.route('/exercise-performances', exercisePerformancesRouter);


//============================================================================================
//--- EXERCISE LAPS ---
//============================================================================================


export default app;