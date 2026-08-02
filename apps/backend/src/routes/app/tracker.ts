import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, inArray, sql, gte, lte, desc, asc } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { requireAuth } from '../../middleware/auth'
import { dayLogs, exerciseListItems, exerciseLists, exerciseLogs, exercisePerformances, exerciseSessions, habits } from '../../db/schema'
import db from '../../db/db'
import { defineCrudSchemas } from '../../lib/utilities/drizzle-crud-schemas'
import { generateCrudRouter } from '../../lib/utilities/crud-router-factory'
import { ExercisePerformance } from '@trackbit/types'
import {
    computeFrozenExercisesForUser,
    computeFrozenHabitsForUser,
} from '../../lib/user-limits.js'

function frozenHabitException(habitId: number) {
    return new HTTPException(403, {
        res: new Response(
            JSON.stringify({
                error: 'habit_frozen',
                message: 'This habit is frozen because your role limits were reduced.',
                habitId,
            }),
            { status: 403, headers: { 'content-type': 'application/json' } }
        ),
    })
}

function frozenExerciseException(exerciseId: number) {
    return new HTTPException(403, {
        res: new Response(
            JSON.stringify({
                error: 'custom_exercise_frozen',
                message: 'This custom exercise is frozen because your role limits were reduced.',
                exerciseId,
            }),
            { status: 403, headers: { 'content-type': 'application/json' } }
        ),
    })
}




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

    const frozen = await computeFrozenHabitsForUser(user.id, user.role);
    const annotated = habitsWithLogs.map((h) => ({ ...h, frozen: frozen.has(h.id) }));

    return c.json(annotated.length > 0 ? annotated : []);
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
        const user = c.get('user');
        const { habitId, rating, timeStamp } = c.req.valid('json');
        const tz = c.req.query('tz') || 'America/Costa_Rica';

        const frozen = await computeFrozenHabitsForUser(user.id, user.role);
        if (frozen.has(habitId)) {
            return c.json({
                error: 'habit_frozen',
                message: 'This habit is frozen and cannot be tracked.',
                habitId,
            }, 403);
        }

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
    },
    beforeCreate: async (c, data) => {
        const user = c.get('user');
        const habitId = (data as any).habitId as number;
        const frozen = await computeFrozenHabitsForUser(user.id, user.role);
        if (frozen.has(habitId)) {
            throw frozenHabitException(habitId);
        }
        return data;
    },
    beforeUpdate: async (c, data) => {
        const user = c.get('user');
        const id = Number(c.req.param('id'));
        const [row] = await db
            .select({ habitId: dayLogs.habitId })
            .from(dayLogs)
            .where(eq(dayLogs.id, id))
            .limit(1);
        if (row) {
            const frozen = await computeFrozenHabitsForUser(user.id, user.role);
            if (frozen.has(row.habitId)) {
                throw frozenHabitException(row.habitId);
            }
        }
        return data;
    },
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
    beforeCreate: async (c, data) => {
        const user = c.get('user');
        const dayLogId = (data as any).dayLogId as number;
        const [parentLog] = await db
            .select({ habitId: dayLogs.habitId })
            .from(dayLogs)
            .where(eq(dayLogs.id, dayLogId))
            .limit(1);
        if (parentLog) {
            const frozen = await computeFrozenHabitsForUser(user.id, user.role);
            if (frozen.has(parentLog.habitId)) {
                throw frozenHabitException(parentLog.habitId);
            }
        }
        return data;
    },
    beforeUpdate: async (c, data) => {
        const user = c.get('user');
        const id = Number(c.req.param('id'));
        const [row] = await db
            .select({ habitId: dayLogs.habitId })
            .from(exerciseSessions)
            .innerJoin(dayLogs, eq(dayLogs.id, exerciseSessions.dayLogId))
            .where(eq(exerciseSessions.id, id))
            .limit(1);
        if (row) {
            const frozen = await computeFrozenHabitsForUser(user.id, user.role);
            if (frozen.has(row.habitId)) {
                throw frozenHabitException(row.habitId);
            }
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
// Provenance is write-once. Without this omission a PATCH could re-point an
// existing log at any list item — including another user's, since the ownership
// check only guards creation — silently rewriting adherence history.
const exerciseLogUpdateSchema = exerciseLogsSchemas.create
    .omit({ listItemId: true })
    .partial()
    .refine(
        (data: Record<string, unknown>) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided for update' }
    );

// TODO: exercise logs should be ordered by createdAt, similar exercise sets
const exerciseLogsRouter = generateCrudRouter({
    table: exerciseLogs,
    schemas: { ...exerciseLogsSchemas, update: exerciseLogUpdateSchema },
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

    beforeUpdate: async (c, data) => {
        const user = c.get('user');
        const id = Number(c.req.param('id'));
        const [row] = await db
            .select({
                habitId: dayLogs.habitId,
                exerciseId: exerciseLogs.exerciseId,
            })
            .from(exerciseLogs)
            .innerJoin(exerciseSessions, eq(exerciseSessions.id, exerciseLogs.exerciseSessionId))
            .innerJoin(dayLogs, eq(dayLogs.id, exerciseSessions.dayLogId))
            .where(eq(exerciseLogs.id, id))
            .limit(1);
        if (row) {
            const [frozenHabits, frozenExercises] = await Promise.all([
                computeFrozenHabitsForUser(user.id, user.role),
                computeFrozenExercisesForUser(user.id, user.role),
            ]);
            if (frozenHabits.has(row.habitId)) {
                throw frozenHabitException(row.habitId);
            }
            if (frozenExercises.has(row.exerciseId)) {
                throw frozenExerciseException(row.exerciseId);
            }
        }
        return data;
    },
    overrides: {
        create: async (c) => {
            //TODO: this values should be inferred from schema, this should be handeled in the generateCrudRouter
            const body = c.req.valid("json") as any;
            const user = c.get('user');

            // Freeze gates: block logs against frozen custom exercises or frozen parent habits.
            const [frozenExercises, [parentSession]] = await Promise.all([
                computeFrozenExercisesForUser(user.id, user.role),
                db
                    .select({ dayLogId: exerciseSessions.dayLogId })
                    .from(exerciseSessions)
                    .where(eq(exerciseSessions.id, body.exerciseSessionId))
                    .limit(1),
            ]);

            if (frozenExercises.has(body.exerciseId)) {
                throw frozenExerciseException(body.exerciseId);
            }

            if (parentSession) {
                const [parentLog] = await db
                    .select({ habitId: dayLogs.habitId })
                    .from(dayLogs)
                    .where(eq(dayLogs.id, parentSession.dayLogId))
                    .limit(1);
                if (parentLog) {
                    const frozenHabits = await computeFrozenHabitsForUser(user.id, user.role);
                    if (frozenHabits.has(parentLog.habitId)) {
                        throw frozenHabitException(parentLog.habitId);
                    }
                }
            }

            // Provenance: only accept a list item that belongs to one of the
            // user's own lists, otherwise the log would point at someone else's
            // routine and skew their adherence reporting.
            let listItemId: number | null = null;
            if (body.listItemId != null) {
                const [ownedItem] = await db
                    .select({ id: exerciseListItems.id })
                    .from(exerciseListItems)
                    .innerJoin(exerciseLists, eq(exerciseLists.id, exerciseListItems.listId))
                    .where(and(
                        eq(exerciseListItems.id, body.listItemId),
                        eq(exerciseLists.userId, user.id),
                    ))
                    .limit(1);

                if (!ownedItem) {
                    throw new HTTPException(400, {
                        res: new Response(
                            JSON.stringify({
                                error: 'exercise_list_item_not_found',
                                message: 'The referenced list item does not exist or is not yours.',
                                listItemId: body.listItemId,
                            }),
                            { status: 400, headers: { 'content-type': 'application/json' } }
                        ),
                    });
                }
                listItemId = ownedItem.id;
            }

            return await db.transaction(async (tx) => {
                // 1. Create the Exercise Log Header
                const logRes = await tx.insert(exerciseLogs).values({
                    exerciseSessionId: body.exerciseSessionId,
                    exerciseId: body.exerciseId,
                    listItemId,
                }).returning();

                const newLogId = logRes[0].id;

                // If sets provided, use them. If not, do not insert any set.
                let setRes: ExercisePerformance[] = [];
                if ((body.exercisePerformances && body.exercisePerformances.length > 0)) {
                    console.log('Inserting provided sets:', body.exercisePerformances);
                    setRes = await tx.insert(exercisePerformances).values(
                        body.exercisePerformances.map((s: { reps: number, weight: number, number: number }) => ({
                            exerciseLogId: newLogId,
                            number: s.number,
                            reps: s.reps,
                            weight: s.weight,
                        }))
                    ).returning();
                }

                // 4. Return combined structure
                return c.json({
                    ...logRes[0],
                    sets: setRes,
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
    // `distance` is a pg `numeric` column mapped to a JS number; unlike the `real`/`integer`
    // columns on this table, drizzle-zod doesn't coerce it, so numeric strings must be allowed too.
    refine: (schema) => schema.extend({
        distance: z.coerce.number().nullable().optional(),
    }),
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