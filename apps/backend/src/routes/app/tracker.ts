import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, inArray, sql, gte, lte, desc, asc } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { requireAuth } from '../../middleware/auth'
import { dayLogs, exerciseListItems, exerciseLists, exerciseLogs, exercisePerformances, exerciseSessions, habits } from '../../db/schema'
import db from '../../db/db'
import { defineCrudSchemas } from '../../lib/utilities/drizzle-crud-schemas'
import { generateCrudRouter } from '../../lib/utilities/crud-router-factory'
import { ExercisePerformance, resolveColorStops } from '@trackbit/types'
import {
    computeFrozenExercisesForUser,
    computeFrozenHabitsForUser,
} from '../../lib/user-limits.js'
import { addDays, localDaySchema, resolveDay } from '../../lib/user-day.js'
import { MAX_STREAK_DAYS, streakEndingAt, type StreakDay } from '../../lib/streak.js'
import { idempotency } from '../../middleware/idempotency.js'
import { t, negotiateFromHeader } from '../../i18n/index.js'

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

app.get(
    '/history',
    zValidator('query', z.object({
        start: localDaySchema.optional(),
        end: localDaySchema.optional(),
    })),
    async (c) => {
        const user = c.get('user');
        const { start, end } = c.req.valid('query');

        const conditions = [];
        if (start) conditions.push(gte(dayLogs.localDay, start));
        if (end) conditions.push(lte(dayLogs.localDay, end));

        const habitsWithLogs = await db.query.habits.findMany({
            where: eq(habits.userId, user.id),
            with: {
                dayLogs: {
                    where: conditions.length > 0 ? and(...conditions) : undefined,
                    orderBy: desc(dayLogs.localDay),
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
        return c.json(habitsWithLogs.map((h) => ({ ...h, frozen: frozen.has(h.id) })));
    }
);

//============================================================================================
//--- TODAY SUMMARY ---
// Lightweight per-habit state for one day (default: the user's today), sized for
// widget refreshes. Clients show the current streak as
//   dayCounts(today) ? streakBeforeDay + 1 : 0
// using their own (possibly optimistic) value for today; see lib/streak.ts.
//============================================================================================

const RECENT_DAYS = 7;

app.get(
    '/today',
    zValidator('query', z.object({ day: localDaySchema.optional() })),
    async (c) => {
        const user = c.get('user');
        const day = resolveDay(user, c.req.valid('query').day);
        const windowStart = addDays(day, -MAX_STREAK_DAYS);

        const userHabits = await db
            .select()
            .from(habits)
            .where(eq(habits.userId, user.id))
            .orderBy(asc(habits.order), asc(habits.createdAt));
        const habitIds = userHabits.map((h) => h.id);

        const [logs, firstLogs, frozen] = habitIds.length === 0
            ? [[], [], new Set<number>()] as const
            : await Promise.all([
                db
                    .select({
                        habitId: dayLogs.habitId,
                        localDay: dayLogs.localDay,
                        rating: dayLogs.rating,
                        sessionCount: sql<number>`count(${exerciseSessions.id})::int`,
                    })
                    .from(dayLogs)
                    .leftJoin(exerciseSessions, eq(exerciseSessions.dayLogId, dayLogs.id))
                    .where(and(
                        inArray(dayLogs.habitId, habitIds),
                        gte(dayLogs.localDay, windowStart),
                        lte(dayLogs.localDay, day),
                    ))
                    .groupBy(dayLogs.id),
                db
                    .select({ habitId: dayLogs.habitId, firstLogDay: sql<string>`min(${dayLogs.localDay})` })
                    .from(dayLogs)
                    .where(inArray(dayLogs.habitId, habitIds))
                    .groupBy(dayLogs.habitId),
                computeFrozenHabitsForUser(user.id, user.role),
            ]);

        const logsByHabit = new Map<number, Map<string, StreakDay>>();
        for (const l of logs) {
            if (!logsByHabit.has(l.habitId)) logsByHabit.set(l.habitId, new Map());
            logsByHabit.get(l.habitId)!.set(l.localDay, { rating: l.rating, sessionCount: l.sessionCount });
        }
        const firstLogDayByHabit = new Map(firstLogs.map((f) => [f.habitId, f.firstLogDay]));
        const recentDays = Array.from({ length: RECENT_DAYS }, (_, i) => addDays(day, i - RECENT_DAYS + 1));

        return c.json({
            day,
            habits: userHabits.map((h) => {
                const habitLogs = logsByHabit.get(h.id) ?? new Map<string, StreakDay>();
                const firstLogDay = firstLogDayByHabit.get(h.id) ?? null;
                return {
                    id: h.id,
                    name: h.name,
                    description: h.description,
                    type: h.type,
                    isAntiHabit: h.isAntiHabit,
                    icon: h.icon,
                    colorTheme: h.colorTheme,
                    colorStops: resolveColorStops(h),
                    dailyGoal: h.dailyGoal,
                    weeklyGoal: h.weeklyGoal,
                    order: h.order,
                    frozen: frozen.has(h.id),
                    firstLogDay,
                    streakBeforeDay: streakEndingAt(h, habitLogs, addDays(day, -1), firstLogDay),
                    recent: recentDays.map((d) => ({
                        day: d,
                        rating: habitLogs.get(d)?.rating ?? null,
                        sessionCount: habitLogs.get(d)?.sessionCount ?? 0,
                    })),
                };
            }),
        });
    }
);

//============================================================================================
//--- DAY LOG WRITES ---
// Every write targets one (habit, localDay) row, enforced by day_logs_habit_day_uq.
// `day` is the user's calendar day; when omitted the server uses the user's today.
//============================================================================================

/** The habit must belong to the user and not be frozen. */
async function assertTrackableHabit(c: Context, habitId: number) {
    const user = c.get('user');
    const [owned] = await db
        .select({ id: habits.id })
        .from(habits)
        .where(and(eq(habits.id, habitId), eq(habits.userId, user.id)))
        .limit(1);
    if (!owned) {
        const locale = negotiateFromHeader(c.req.header('accept-language'));
        throw new HTTPException(404, {
            res: Response.json({ error: t('errors', 'habit_not_found', locale) }, { status: 404 }),
        });
    }
    const frozen = await computeFrozenHabitsForUser(user.id, user.role);
    if (frozen.has(habitId)) throw frozenHabitException(habitId);
}

const habitIdSchema = z.number().int().positive();

// Sets the day's rating to an absolute value.
app.post(
    '/check',
    idempotency,
    zValidator('json', z.object({
        habitId: habitIdSchema,
        rating: z.number().int(),
        day: localDaySchema.optional(),
    }).strict()),
    async (c) => {
        const { habitId, rating, day } = c.req.valid('json');
        await assertTrackableHabit(c, habitId);
        const localDay = resolveDay(c.get('user'), day);

        const [row] = await db
            .insert(dayLogs)
            .values({ habitId, localDay, rating })
            .onConflictDoUpdate({
                target: [dayLogs.habitId, dayLogs.localDay],
                set: { rating },
            })
            .returning();

        return c.json(row);
    }
);

// Adds `delta` to the day's rating atomically, so concurrent clients (web, widgets)
// never lose an update. Not idempotent by itself: retries must send Idempotency-Key.
app.post(
    '/check/increment',
    idempotency,
    zValidator('json', z.object({
        habitId: habitIdSchema,
        delta: z.number().int().refine((d) => d !== 0, 'delta must not be 0'),
        day: localDaySchema.optional(),
    }).strict()),
    async (c) => {
        const { habitId, delta, day } = c.req.valid('json');
        await assertTrackableHabit(c, habitId);
        const localDay = resolveDay(c.get('user'), day);

        const [row] = await db
            .insert(dayLogs)
            .values({ habitId, localDay, rating: delta })
            .onConflictDoUpdate({
                target: [dayLogs.habitId, dayLogs.localDay],
                set: { rating: sql`coalesce(${dayLogs.rating}, 0) + excluded.rating` },
            })
            .returning();

        return c.json(row);
    }
);

// Returns the day's log, creating an empty one if needed (e.g. to attach a session).
app.post(
    '/day-logs/ensure',
    idempotency,
    zValidator('json', z.object({
        habitId: habitIdSchema,
        day: localDaySchema.optional(),
    }).strict()),
    async (c) => {
        const { habitId, day } = c.req.valid('json');
        await assertTrackableHabit(c, habitId);
        const localDay = resolveDay(c.get('user'), day);

        await db
            .insert(dayLogs)
            .values({ habitId, localDay })
            .onConflictDoNothing({ target: [dayLogs.habitId, dayLogs.localDay] });

        const [row] = await db
            .select()
            .from(dayLogs)
            .where(and(eq(dayLogs.habitId, habitId), eq(dayLogs.localDay, localDay)))
            .limit(1);

        return c.json(row);
    }
);



//============================================================================================
//--- DAY LOGS ROUTER (CRUD) ---
//============================================================================================

// Zod Schemas for DayLogs
// A log's (habitId, localDay) identity is immutable; rows are created only through
// the upserts above, so the CRUD router omits create.
const dayLogSchemas = defineCrudSchemas(dayLogs, {
    omitFromCreateUpdate: ['id', 'createdAt', 'habitId', 'localDay'],
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
    ommitOperations: ['create'],
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