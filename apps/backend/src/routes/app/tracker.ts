import { Hono, type Context } from 'hono'
import { validator } from '../../lib/validator.js'
import { z } from 'zod'
import { eq, and, or, isNull, inArray, sql, gte, lte, desc, asc, type SQL } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { requireAuth } from '../../middleware/auth'
import { dayLogs, exerciseListItems, exerciseLists, exerciseLogs, exercisePerformances, exercises, exerciseSessions, habits } from '../../db/schema'
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
import { frozenExerciseException, frozenHabitException } from '../../lib/frozen-errors.js'


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
    validator('query', z.object({
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

/** Every day log of the habits matching `habitFilter` from `start` to `end`, with its session count. */
function daySummaries(habitFilter: SQL, start: string, end: string) {
    return db
        .select({
            habitId: dayLogs.habitId,
            localDay: dayLogs.localDay,
            rating: dayLogs.rating,
            sessionCount: sql<number>`count(${exerciseSessions.id})::int`,
        })
        .from(dayLogs)
        .leftJoin(exerciseSessions, eq(exerciseSessions.dayLogId, dayLogs.id))
        .where(and(habitFilter, gte(dayLogs.localDay, start), lte(dayLogs.localDay, end)))
        .groupBy(dayLogs.id)
        .orderBy(asc(dayLogs.habitId), asc(dayLogs.localDay));
}

app.get(
    '/today',
    validator('query', z.object({ day: localDaySchema.optional() })),
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
                daySummaries(inArray(dayLogs.habitId, habitIds), windowStart, day),
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
//--- DAYS ---
// The per-day values behind /today's `recent`, for any range: what heatmaps need without the
// exercise session trees /history carries. Sparse: a day without a log is left out.
//============================================================================================

const MAX_DAYS_RANGE = 371;

app.get(
    '/days',
    validator('query', z.object({
        start: localDaySchema,
        end: localDaySchema,
    }).refine(({ start, end }) => start <= end, { message: 'start must not be after end', path: ['start'] })
        .refine(({ start, end }) => addDays(start, MAX_DAYS_RANGE - 1) >= end, {
            message: `At most ${MAX_DAYS_RANGE} days`, path: ['end'],
        })),
    async (c) => {
        const user = c.get('user');
        const { start, end } = c.req.valid('query');
        const owned = db.select({ id: habits.id }).from(habits).where(eq(habits.userId, user.id));
        const days = await daySummaries(inArray(dayLogs.habitId, owned), start, end);
        return c.json({
            start,
            end,
            days: days.map((d) => ({ habitId: d.habitId, day: d.localDay, rating: d.rating, sessionCount: d.sessionCount })),
        });
    }
);

//============================================================================================
//--- DAY LOG WRITES ---
// Every write targets one (habit, localDay) row, enforced by day_logs_habit_day_uq.
// `day` is the user's calendar day; when omitted the server uses the user's today.
//============================================================================================

function notFoundException(c: Context, key: 'habit_not_found' | 'not_found_or_unauthorized') {
    const locale = negotiateFromHeader(c.req.header('accept-language'));
    return new HTTPException(404, {
        res: Response.json({ error: t('errors', key, locale) }, { status: 404 }),
    });
}

async function assertOwnedHabit(c: Context, habitId: number) {
    const [owned] = await db
        .select({ id: habits.id })
        .from(habits)
        .where(and(eq(habits.id, habitId), eq(habits.userId, c.get('user').id)))
        .limit(1);
    if (!owned) throw notFoundException(c, 'habit_not_found');
}

/** The habit must belong to the user and not be frozen. */
async function assertTrackableHabit(c: Context, habitId: number) {
    await assertOwnedHabit(c, habitId);
    const user = c.get('user');
    const frozen = await computeFrozenHabitsForUser(user.id, user.role);
    if (frozen.has(habitId)) throw frozenHabitException(habitId);
}

// Who a row under a habit belongs to, in one query; undefined when the row doesn't exist.
type Owner = { userId: string; habitId: number };

async function dayLogOwner(dayLogId: number): Promise<Owner | undefined> {
    const [row] = await db
        .select({ userId: habits.userId, habitId: habits.id })
        .from(dayLogs)
        .innerJoin(habits, eq(habits.id, dayLogs.habitId))
        .where(eq(dayLogs.id, dayLogId))
        .limit(1);
    return row;
}

async function sessionOwner(where: SQL): Promise<(Owner & { id: number }) | undefined> {
    const [row] = await db
        .select({ id: exerciseSessions.id, userId: habits.userId, habitId: habits.id })
        .from(exerciseSessions)
        .innerJoin(dayLogs, eq(dayLogs.id, exerciseSessions.dayLogId))
        .innerJoin(habits, eq(habits.id, dayLogs.habitId))
        .where(where)
        .limit(1);
    return row;
}

async function exerciseLogOwner(where: SQL): Promise<(Owner & { id: number; exerciseId: number }) | undefined> {
    const [row] = await db
        .select({ id: exerciseLogs.id, userId: habits.userId, habitId: habits.id, exerciseId: exerciseLogs.exerciseId })
        .from(exerciseLogs)
        .innerJoin(exerciseSessions, eq(exerciseSessions.id, exerciseLogs.exerciseSessionId))
        .innerJoin(dayLogs, eq(dayLogs.id, exerciseSessions.dayLogId))
        .innerJoin(habits, eq(habits.id, dayLogs.habitId))
        .where(where)
        .limit(1);
    return row;
}

async function performanceOwner(where: SQL): Promise<(Owner & { id: number; exerciseId: number }) | undefined> {
    const [row] = await db
        .select({ id: exercisePerformances.id, userId: habits.userId, habitId: habits.id, exerciseId: exerciseLogs.exerciseId })
        .from(exercisePerformances)
        .innerJoin(exerciseLogs, eq(exerciseLogs.id, exercisePerformances.exerciseLogId))
        .innerJoin(exerciseSessions, eq(exerciseSessions.id, exerciseLogs.exerciseSessionId))
        .innerJoin(dayLogs, eq(dayLogs.id, exerciseSessions.dayLogId))
        .innerJoin(habits, eq(habits.id, dayLogs.habitId))
        .where(where)
        .limit(1);
    return row;
}

/** [owner] must be the user's; a missing row looks the same as someone else's. */
function assertOwned<T extends Owner>(c: Context, owner: T | undefined): asserts owner is T {
    if (!owner || owner.userId !== c.get('user').id) throw notFoundException(c, 'not_found_or_unauthorized');
}

/**
 * A write under [owner]'s habit: 404 unless it is the user's (a missing parent looks the same as
 * someone else's), 403 if the habit is frozen.
 */
async function assertWritable(c: Context, owner: Owner | undefined) {
    assertOwned(c, owner);
    const user = c.get('user');
    const frozen = await computeFrozenHabitsForUser(user.id, user.role);
    if (frozen.has(owner.habitId)) throw frozenHabitException(owner.habitId);
}

/** The exercise must be a system one or the user's own, and not frozen. */
async function assertLoggableExercise(c: Context, exerciseId: number) {
    const user = c.get('user');
    const [visible] = await db
        .select({ id: exercises.id })
        .from(exercises)
        .where(and(eq(exercises.id, exerciseId), or(isNull(exercises.userId), eq(exercises.userId, user.id))))
        .limit(1);
    if (!visible) throw notFoundException(c, 'not_found_or_unauthorized');
    const frozen = await computeFrozenExercisesForUser(user.id, user.role);
    if (frozen.has(exerciseId)) throw frozenExerciseException(exerciseId);
}

const habitIdSchema = z.number().int().positive();

// Sets the day's rating to an absolute value.
app.post(
    '/check',
    idempotency,
    validator('json', z.object({
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
    validator('json', z.object({
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
    validator('json', z.object({
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
    // Day logs are read through /today, /days and /history.
    ommitOperations: ['create', 'list'],
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


// Every row here has a `uuid` the client may choose at creation (see the schema), and children
// may name their parent by it, so an offline client can queue a session, its logs and their sets
// at once. A create retried with the same uuid returns the row it made the first time; the same
// uuid under another parent is a 409. Rows also take Idempotency-Key, like every tracker write.

const positiveInt = z.number().int().positive();

/** Exactly one of [a] and [b]: a parent given by id or by uuid. */
const oneOf = (a: string, b: string) => (body: Record<string, unknown>) => (body[a] == null) !== (body[b] == null);

function uuidConflictException() {
    return new HTTPException(409, {
        res: Response.json({ error: 'uuid_conflict', message: 'This uuid already names another row.' }, { status: 409 }),
    });
}

/**
 * The row a create with [uuid] already made, or undefined if there is none. It must sit under the
 * same parent ([sameParent]), or the uuid is someone else's.
 */
async function existingByUuid<T>(rows: T[], sameParent: (row: T) => boolean): Promise<T | undefined> {
    const [row] = rows;
    if (row && !sameParent(row)) throw uuidConflictException();
    return row;
}

/** DELETE `/<rows>/uuid/:uuid`: the row the client created, by the uuid it chose. */
function deleteByUuid(
    path: string,
    owner: (where: SQL) => Promise<Owner | undefined>,
    remove: (uuid: string) => Promise<unknown>,
    uuidColumn: Parameters<typeof eq>[0],
) {
    app.delete(path, validator('param', z.object({ uuid: z.uuid() })), async (c) => {
        const { uuid } = c.req.valid('param');
        assertOwned(c, await owner(eq(uuidColumn, uuid)));
        await remove(uuid);
        return c.json({ success: true, uuid });
    });
}

//============================================================================================
//--- EXERCISE SESSIONS ---
//============================================================================================

const sessionSchemas = defineCrudSchemas(exerciseSessions, {
    omitFromCreateUpdate: ['id', 'uuid', 'createdAt'],
});

// Starts a session on a day log, given by id or by (habitId, day). The second form ensures the
// day's log first, so a client can start a session without knowing the log's id (the Android
// outbox, offline).
app.post(
    '/exercise-sessions',
    idempotency,
    validator('json', z.union([
        z.object({ uuid: z.uuid().optional(), dayLogId: positiveInt }).strict(),
        z.object({ uuid: z.uuid().optional(), habitId: habitIdSchema, day: localDaySchema.optional() }).strict(),
    ])),
    async (c) => {
        const body = c.req.valid('json');
        let dayLogId: number;
        if ('dayLogId' in body) {
            await assertWritable(c, await dayLogOwner(body.dayLogId));
            dayLogId = body.dayLogId;
        } else {
            await assertTrackableHabit(c, body.habitId);
            const localDay = resolveDay(c.get('user'), body.day);
            await db
                .insert(dayLogs)
                .values({ habitId: body.habitId, localDay })
                .onConflictDoNothing({ target: [dayLogs.habitId, dayLogs.localDay] });
            const [log] = await db
                .select({ id: dayLogs.id })
                .from(dayLogs)
                .where(and(eq(dayLogs.habitId, body.habitId), eq(dayLogs.localDay, localDay)))
                .limit(1);
            dayLogId = log.id;
        }

        const [created] = await db
            .insert(exerciseSessions)
            .values({ uuid: body.uuid, dayLogId })
            .onConflictDoNothing({ target: exerciseSessions.uuid })
            .returning();
        const session = created ?? await existingByUuid(
            await db.select().from(exerciseSessions).where(eq(exerciseSessions.uuid, body.uuid!)),
            (row) => row.dayLogId === dayLogId,
        );
        return c.json(session, 201);
    }
);

// One habit's sessions on one day, oldest first, each with its logs and their sets: what a session
// screen shows. Unlike /history, sized for one day.
app.get(
    '/exercise-sessions',
    validator('query', z.object({ habitId: z.coerce.number().int().positive(), day: localDaySchema })),
    async (c) => {
        const { habitId, day } = c.req.valid('query');
        await assertOwnedHabit(c, habitId);

        const log = await db.query.dayLogs.findFirst({
            where: and(eq(dayLogs.habitId, habitId), eq(dayLogs.localDay, day)),
            with: {
                exerciseSessions: {
                    orderBy: [asc(exerciseSessions.createdAt), asc(exerciseSessions.id)],
                    with: {
                        exerciseLogs: {
                            orderBy: [asc(exerciseLogs.createdAt), asc(exerciseLogs.id)],
                            with: {
                                exercisePerformances: {
                                    orderBy: [asc(exercisePerformances.createdAt), asc(exercisePerformances.id)],
                                },
                            },
                        },
                    },
                },
            },
        });
        return c.json(log?.exerciseSessions ?? []);
    }
);

deleteByUuid('/exercise-sessions/uuid/:uuid', sessionOwner,
    (uuid) => db.delete(exerciseSessions).where(eq(exerciseSessions.uuid, uuid)), exerciseSessions.uuid);

const sessionRouter = generateCrudRouter({
    table: exerciseSessions,
    schemas: sessionSchemas,
    primaryKeyFields: ['id'],
    ownershipCheck: async (user, record) => (await dayLogOwner(record.dayLogId))?.userId === user.id,
    // Create and list are the routes above. A session's only field is its day log, which never moves.
    ommitOperations: ['create', 'list', 'update'],
});

app.route('/exercise-sessions', sessionRouter);

//============================================================================================
//--- EXERCISE LOGS ---
//============================================================================================

const exerciseLogsSchemas = defineCrudSchemas(exerciseLogs, {
    omitFromCreateUpdate: ['id', 'uuid', 'createdAt'],
});
// Provenance is write-once. Without this omission a PATCH could re-point an
// existing log at any list item — including another user's, since the ownership
// check only guards creation — silently rewriting adherence history. The session
// and exercise are the log's identity: moving it could put it under another user's
// session.
const exerciseLogUpdateSchema = exerciseLogsSchemas.create
    .omit({ listItemId: true, exerciseSessionId: true, exerciseId: true })
    .partial()
    .refine(
        (data: Record<string, unknown>) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided for update' }
    );

// Adds an exercise to a session (by id or uuid), optionally with first sets. Returns the log
// with `sets`.
app.post(
    '/exercise-logs',
    idempotency,
    validator('json', z.object({
        uuid: z.uuid().optional(),
        exerciseSessionId: positiveInt.optional(),
        exerciseSessionUuid: z.uuid().optional(),
        exerciseId: positiveInt,
        // Provenance: the list item this was logged from, when it came from a source queue.
        listItemId: positiveInt.nullable().optional(),
        distance: z.number().nullable().optional(),
        duration: z.number().int().nullable().optional(),
        distanceUnit: z.string().nullable().optional(),
        weightUnit: z.string().nullable().optional(),
        exercisePerformances: z.array(
            z.object({
                reps: z.number().min(0).nullable(),
                weight: z.number().min(0).nullable(),
                number: z.number().min(0).nullable(),
            })
        ).optional(),
    }).strict().refine(oneOf('exerciseSessionId', 'exerciseSessionUuid'), {
        message: 'Give exerciseSessionId or exerciseSessionUuid', path: ['exerciseSessionId'],
    })),
    async (c) => {
        const { uuid, exerciseSessionId, exerciseSessionUuid, exercisePerformances: sets, listItemId: itemId, ...values } = c.req.valid('json');
        const user = c.get('user');

        const session = await sessionOwner(exerciseSessionId != null
            ? eq(exerciseSessions.id, exerciseSessionId)
            : eq(exerciseSessions.uuid, exerciseSessionUuid!));
        await assertWritable(c, session);
        await assertLoggableExercise(c, values.exerciseId);

        // Provenance: only accept a list item that belongs to one of the
        // user's own lists, otherwise the log would point at someone else's
        // routine and skew their adherence reporting.
        let listItemId: number | null = null;
        if (itemId != null) {
            const [ownedItem] = await db
                .select({ id: exerciseListItems.id })
                .from(exerciseListItems)
                .innerJoin(exerciseLists, eq(exerciseLists.id, exerciseListItems.listId))
                .where(and(
                    eq(exerciseListItems.id, itemId),
                    eq(exerciseLists.userId, user.id),
                ))
                .limit(1);

            if (!ownedItem) {
                throw new HTTPException(400, {
                    res: Response.json({
                        error: 'exercise_list_item_not_found',
                        message: 'The referenced list item does not exist or is not yours.',
                        listItemId: itemId,
                    }, { status: 400 }),
                });
            }
            listItemId = ownedItem.id;
        }

        return await db.transaction(async (tx) => {
            const [created] = await tx
                .insert(exerciseLogs)
                .values({ ...values, uuid, exerciseSessionId: session!.id, listItemId })
                .onConflictDoNothing({ target: exerciseLogs.uuid })
                .returning();
            if (!created) {
                const log = await existingByUuid(
                    await tx.select().from(exerciseLogs).where(eq(exerciseLogs.uuid, uuid!)),
                    (row) => row.exerciseSessionId === session!.id,
                );
                const existingSets = await tx.select().from(exercisePerformances)
                    .where(eq(exercisePerformances.exerciseLogId, log!.id))
                    .orderBy(asc(exercisePerformances.createdAt), asc(exercisePerformances.id));
                return c.json({ ...log, sets: existingSets });
            }

            // If sets provided, use them. If not, do not insert any set.
            let setRes: ExercisePerformance[] = [];
            if (sets && sets.length > 0) {
                setRes = await tx.insert(exercisePerformances).values(
                    sets.map((s) => ({
                        exerciseLogId: created.id,
                        number: s.number ?? 1,
                        reps: s.reps,
                        weight: s.weight,
                    }))
                ).returning();
            }
            return c.json({ ...created, sets: setRes });
        });
    }
);

deleteByUuid('/exercise-logs/uuid/:uuid', exerciseLogOwner,
    (uuid) => db.delete(exerciseLogs).where(eq(exerciseLogs.uuid, uuid)), exerciseLogs.uuid);

const exerciseLogsRouter = generateCrudRouter({
    table: exerciseLogs,
    schemas: { ...exerciseLogsSchemas, update: exerciseLogUpdateSchema },
    primaryKeyFields: ['id'],
    ownershipCheck: async (user, record) =>
        (await sessionOwner(eq(exerciseSessions.id, record.exerciseSessionId)))?.userId === user.id,
    // Create is the route above; logs are read with their session (GET /exercise-sessions, /history).
    ommitOperations: ['create', 'list'],

    beforeUpdate: async (c, data) => {
        const owner = await exerciseLogOwner(eq(exerciseLogs.id, Number(c.req.param('id'))));
        // Someone else's (or no) log gets the router's 404.
        if (owner && owner.userId === c.get('user').id) {
            await assertWritable(c, owner);
            await assertLoggableExercise(c, owner.exerciseId);
        }
        return data;
    },
});

app.route('/exercise-logs', exerciseLogsRouter);

//============================================================================================
//--- EXERCISE PERFORMANCES ---
//============================================================================================

const exercisePerformanceSchemas = defineCrudSchemas(exercisePerformances, {
    omitFromCreateUpdate: ['id', 'uuid', 'createdAt'],
    // `distance` is a pg `numeric` column mapped to a JS number; unlike the `real`/`integer`
    // columns on this table, drizzle-zod doesn't coerce it, so numeric strings must be allowed too.
    refine: (schema) => schema.extend({
        distance: z.coerce.number().nullable().optional(),
    }),
});
// A set stays in its log: moving it could put it under another user's log.
const exercisePerformanceUpdateSchema = exercisePerformanceSchemas.create
    .omit({ exerciseLogId: true })
    .partial()
    .refine(
        (data: Record<string, unknown>) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided for update' }
    );

/** A set write passes the same gates as a write to its log. */
async function assertWritableSet(c: Context, owner: (Owner & { exerciseId: number }) | undefined) {
    await assertWritable(c, owner);
    await assertLoggableExercise(c, owner!.exerciseId);
}

// Adds a set to a log (by id or uuid).
app.post(
    '/exercise-performances',
    idempotency,
    validator('json', exercisePerformanceSchemas.create
        .omit({ exerciseLogId: true })
        .extend({
            uuid: z.uuid().optional(),
            exerciseLogId: positiveInt.optional(),
            exerciseLogUuid: z.uuid().optional(),
        })
        .strict()
        .refine(oneOf('exerciseLogId', 'exerciseLogUuid'), {
            message: 'Give exerciseLogId or exerciseLogUuid', path: ['exerciseLogId'],
        })),
    async (c) => {
        const { uuid, exerciseLogId, exerciseLogUuid, ...values } = c.req.valid('json') as Record<string, any>;
        const log = await exerciseLogOwner(exerciseLogId != null
            ? eq(exerciseLogs.id, exerciseLogId)
            : eq(exerciseLogs.uuid, exerciseLogUuid));
        await assertWritableSet(c, log);

        const [created] = await db
            .insert(exercisePerformances)
            .values({ ...values, uuid, exerciseLogId: log!.id })
            .onConflictDoNothing({ target: exercisePerformances.uuid })
            .returning();
        const set = created ?? await existingByUuid(
            await db.select().from(exercisePerformances).where(eq(exercisePerformances.uuid, uuid)),
            (row) => row.exerciseLogId === log!.id,
        );
        return c.json(set, 201);
    }
);

// Edits a set by the uuid its client chose. Absolute values, so a retry is harmless.
app.patch(
    '/exercise-performances/uuid/:uuid',
    validator('param', z.object({ uuid: z.uuid() })),
    validator('json', exercisePerformanceUpdateSchema),
    async (c) => {
        const { uuid } = c.req.valid('param');
        await assertWritableSet(c, await performanceOwner(eq(exercisePerformances.uuid, uuid)));
        const [updated] = await db
            .update(exercisePerformances)
            .set(c.req.valid('json'))
            .where(eq(exercisePerformances.uuid, uuid))
            .returning();
        return c.json(updated);
    }
);

deleteByUuid('/exercise-performances/uuid/:uuid', performanceOwner,
    (uuid) => db.delete(exercisePerformances).where(eq(exercisePerformances.uuid, uuid)), exercisePerformances.uuid);

const exercisePerformancesRouter = generateCrudRouter({
    table: exercisePerformances,
    schemas: { ...exercisePerformanceSchemas, update: exercisePerformanceUpdateSchema },
    primaryKeyFields: ['id'],
    ownershipCheck: async (user, record) =>
        (await exerciseLogOwner(eq(exerciseLogs.id, record.exerciseLogId)))?.userId === user.id,
    // Create is the route above; sets are read with their session (GET /exercise-sessions, /history).
    ommitOperations: ['create', 'list'],
    beforeUpdate: async (c, data) => {
        const owner = await performanceOwner(eq(exercisePerformances.id, Number(c.req.param('id'))));
        // Someone else's (or no) set gets the router's 404.
        if (owner && owner.userId === c.get('user').id) await assertWritableSet(c, owner);
        return data;
    },
});

app.route('/exercise-performances', exercisePerformancesRouter);


//============================================================================================
//--- EXERCISE LAPS ---
//============================================================================================


export default app;