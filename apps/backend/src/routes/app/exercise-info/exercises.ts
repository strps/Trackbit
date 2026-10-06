import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { and, asc, count, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import db from '../../../db/db.js';
import { dayLogs, exerciseLogs, exerciseMuscleGroups, exercisePerformances, exercises, exerciseSessions, habits, muscleGroups } from '../../../db/schema/index.js';
import { validator } from '../../../lib/validator.js';
import { isUniqueViolation } from '../../../lib/db-errors.js';
import { computeFrozenExercisesForUser, getEffectiveLimits } from '../../../lib/user-limits.js';
import { frozenExerciseException } from '../../../lib/frozen-errors.js';
import { t } from '../../../i18n/index.js';
import { createdBefore, ownExerciseIdByUuid, uuidParamSchema } from '../../../lib/uuid-refs.js';

type AuthEnv = {
    Variables: {
        user: any
        locale: string
    }
}

const EXERCISE_NAME_UNIQUE_INDEX = 'unique_user_exercise_name'

// The custom exercise form's rules (web and Android), enforced here so no client can store more.
// A blank description is stored as null.
const exerciseBodySchema = z.object({
    name: z.string().trim().min(1).max(100),
    // Nullable, not nullish: Zod 4 would run the transform for an omitted field too, and a PATCH
    // without a description would then clear it.
    description: z.string().trim().max(500).nullable().transform((d) => d || null).optional(),
    category: z.enum(['strength', 'cardio', 'flexibility']),
    defaultWeightUnit: z.enum(['kg', 'lbs']).optional(),
    defaultDistanceUnit: z.enum(['km', 'miles']).optional(),
    muscleGroups: z.array(z.number().int().positive()).max(50).transform((ids) => [...new Set(ids)]),
}).strict()

const createSchema = exerciseBodySchema.extend({
    // Chosen by a client creating the exercise offline; a retry with it returns the same exercise.
    uuid: z.uuid().optional(),
    muscleGroups: exerciseBodySchema.shape.muscleGroups.default([]),
})
const updateSchema = exerciseBodySchema.partial().refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: 'At least one field must be provided for update' },
)
const idParamSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * System exercises plus [userId]'s own (or only [onlyId]), named in [locale], each with the
 * user's last set of it, its muscle groups and whether it's frozen.
 */
async function loadExercises(user: { id: string; role?: string | null }, locale: string, onlyId?: number) {
    // Each exercise's most recent set, from this user's own logs only: system
    // exercises are shared, so an unscoped query would show other users' sets.
    const latestSetSubquery = db.$with('latest_sets').as(
        db.select({
            exerciseId: exerciseLogs.exerciseId,
            setId: exercisePerformances.id,
            weight: exercisePerformances.weight,
            reps: exercisePerformances.reps,
            distance: exercisePerformances.distance,
            duration: exercisePerformances.duration,
            createdAt: exercisePerformances.createdAt,
            rpe: exercisePerformances.rpe,
            rowNumber: sql<number>`row_number() over (partition by ${exerciseLogs.exerciseId} order by ${exercisePerformances.createdAt} desc, ${exercisePerformances.id} desc)`.as('row_number'),
        })
            .from(exercisePerformances)
            .innerJoin(exerciseLogs, eq(exerciseLogs.id, exercisePerformances.exerciseLogId))
            .innerJoin(exerciseSessions, eq(exerciseSessions.id, exerciseLogs.exerciseSessionId))
            .innerJoin(dayLogs, eq(dayLogs.id, exerciseSessions.dayLogId))
            .innerJoin(habits, eq(habits.id, dayLogs.habitId))
            .where(eq(habits.userId, user.id))
    );

    const visible = or(isNull(exercises.userId), eq(exercises.userId, user.id))
    const result = await db
        .with(latestSetSubquery)
        .select({
            id: exercises.id,
            uuid: exercises.uuid,
            userId: exercises.userId,
            name: sql<string>`COALESCE(${exercises.nameI18n}->>${locale}, ${exercises.nameI18n}->>'en', ${exercises.name})`.as('name'),
            description: sql<string | null>`COALESCE(${exercises.descriptionI18n}->>${locale}, ${exercises.descriptionI18n}->>'en', ${exercises.description})`.as('description'),
            category: exercises.category,
            defaultWeightUnit: exercises.defaultWeightUnit,
            defaultDistanceUnit: exercises.defaultDistanceUnit,
            lastPerformance: {
                id: latestSetSubquery.setId,
                weight: latestSetSubquery.weight,
                reps: latestSetSubquery.reps,
                distance: latestSetSubquery.distance,
                duration: latestSetSubquery.duration,
                createdAt: latestSetSubquery.createdAt,
                rpe: latestSetSubquery.rpe,
            },
        })
        .from(exercises)
        .leftJoin(
            latestSetSubquery,
            and(
                eq(latestSetSubquery.exerciseId, exercises.id),
                eq(latestSetSubquery.rowNumber, 1)
            )
        )
        .where(onlyId === undefined ? visible : and(visible, eq(exercises.id, onlyId)));

    // Each exercise's muscle groups, named in the request's locale like the exercise.
    const links = result.length === 0 ? [] : await db
        .select({
            exerciseId: exerciseMuscleGroups.exerciseId,
            id: muscleGroups.id,
            name: sql<string>`COALESCE(${muscleGroups.nameI18n}->>${locale}, ${muscleGroups.nameI18n}->>'en', ${muscleGroups.name})`,
        })
        .from(exerciseMuscleGroups)
        .innerJoin(muscleGroups, eq(muscleGroups.id, exerciseMuscleGroups.muscleGroupId))
        .where(inArray(exerciseMuscleGroups.exerciseId, result.map((row) => row.id)))
        .orderBy(asc(muscleGroups.displayOrder), asc(muscleGroups.id))
    const groupsByExercise = new Map<number, { id: number; name: string }[]>()
    for (const { exerciseId, id, name } of links) {
        if (!groupsByExercise.has(exerciseId)) groupsByExercise.set(exerciseId, [])
        groupsByExercise.get(exerciseId)!.push({ id, name })
    }

    const frozen = await computeFrozenExercisesForUser(user.id, user.role)
    return result.map((row) => ({
        ...row,
        muscleGroups: groupsByExercise.get(row.id) ?? [],
        frozen: row.userId === user.id ? frozen.has(row.id) : false,
    }))
}

/** The user's own exercise [id], or undefined (missing, a system one, or another user's). */
async function ownedExercise(userId: string, id: number) {
    const [row] = await db.select({ id: exercises.id, uuid: exercises.uuid }).from(exercises)
        .where(and(eq(exercises.id, id), eq(exercises.userId, userId)))
    return row
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Replaces [exerciseId]'s muscle groups. False if one of [ids] doesn't exist. */
async function setMuscleGroups(tx: Tx, exerciseId: number, ids: number[]): Promise<boolean> {
    if (ids.length > 0) {
        const found = await tx.select({ id: muscleGroups.id }).from(muscleGroups).where(inArray(muscleGroups.id, ids))
        if (found.length !== ids.length) return false
    }
    await tx.delete(exerciseMuscleGroups).where(eq(exerciseMuscleGroups.exerciseId, exerciseId))
    if (ids.length > 0) {
        await tx.insert(exerciseMuscleGroups).values(ids.map((muscleGroupId) => ({ exerciseId, muscleGroupId, role: 'primary' })))
    }
    return true
}

/** Thrown inside a transaction to roll it back and answer 400. */
class UnknownMuscleGroup extends Error {}

const unknownMuscleGroupResponse = {
    error: 'muscle_group_not_found',
    message: 'One or more muscle groups do not exist.',
} as const

const nameTakenResponse = (locale: string) => ({
    error: 'exercise_name_taken',
    message: t('errors', 'exercise_name_taken', locale),
})

const exerciseRouter = new Hono<AuthEnv>()

exerciseRouter.get('/', async (c) => c.json(await loadExercises(c.get('user'), c.get('locale') ?? 'en')))

/** The exercise a create with [uuid] already made (a retry), if any; see lib/uuid-refs.ts. */
const exerciseCreatedBefore = (uuid: string | undefined, userId: string) =>
    createdBefore(uuid, (u) => db.select({ id: exercises.id, userId: exercises.userId }).from(exercises).where(eq(exercises.uuid, u)), userId)

exerciseRouter.post('/', validator('json', createSchema), async (c) => {
    const user = c.get('user')
    const locale = c.get('locale') ?? 'en'
    const { muscleGroups: groupIds, ...values } = c.req.valid('json')

    // A retried create answers with what it made, before the limits (see habits).
    const existing = await exerciseCreatedBefore(values.uuid, user.id)
    if (existing) return c.json((await loadExercises(user, locale, existing.id))[0], 201)

    const limits = await getEffectiveLimits(user.role)
    if (limits && limits.maxCustomExercises != null) {
        const [{ value: existingCount }] = await db
            .select({ value: count() })
            .from(exercises)
            .where(eq(exercises.userId, user.id))

        if (existingCount >= limits.maxCustomExercises) {
            return c.json({
                error: 'custom_exercise_limit_reached',
                message: `You have reached the maximum of ${limits.maxCustomExercises} custom exercises for your role.`,
                maxCustomExercises: limits.maxCustomExercises,
            }, 403)
        }
    }

    try {
        const id = await db.transaction(async (tx) => {
            const [created] = await tx.insert(exercises).values({ ...values, userId: user.id }).returning({ id: exercises.id })
            if (!(await setMuscleGroups(tx, created.id, groupIds))) throw new UnknownMuscleGroup()
            return created.id
        })
        const [exercise] = await loadExercises(user, locale, id)
        return c.json(exercise, 201)
    } catch (err) {
        if (err instanceof UnknownMuscleGroup) return c.json(unknownMuscleGroupResponse, 400)
        // The same create ran concurrently and won.
        if (isUniqueViolation(err, 'exercises_uuid_unique')) {
            const won = await exerciseCreatedBefore(values.uuid, user.id)
            if (won) return c.json((await loadExercises(user, locale, won.id))[0], 201)
        }
        if (isUniqueViolation(err, EXERCISE_NAME_UNIQUE_INDEX)) return c.json(nameTakenResponse(locale), 409)
        throw err
    }
})

const notFound = (c: Context<AuthEnv>) => c.json({ error: t('errors', 'not_found_or_unauthorized', c.get('locale') ?? 'en') }, 404)

/**
 * Only the user's own (custom) exercises can change; system ones are read-only. Applies the fields
 * given and nothing else, so concurrent edits of different fields both survive.
 */
async function updateExercise(c: Context<AuthEnv>, id: number | undefined, body: z.infer<typeof updateSchema>) {
    const user = c.get('user')
    const locale = c.get('locale') ?? 'en'
    const { muscleGroups: groupIds, ...values } = body

    if (id === undefined || !(await ownedExercise(user.id, id))) return notFound(c)
    const frozen = await computeFrozenExercisesForUser(user.id, user.role)
    if (frozen.has(id)) throw frozenExerciseException(id)

    try {
        await db.transaction(async (tx) => {
            if (Object.keys(values).length > 0) await tx.update(exercises).set(values).where(eq(exercises.id, id))
            if (groupIds !== undefined && !(await setMuscleGroups(tx, id, groupIds))) throw new UnknownMuscleGroup()
        })
        const [exercise] = await loadExercises(user, locale, id)
        return c.json(exercise)
    } catch (err) {
        if (err instanceof UnknownMuscleGroup) return c.json(unknownMuscleGroupResponse, 400)
        if (isUniqueViolation(err, EXERCISE_NAME_UNIQUE_INDEX)) return c.json(nameTakenResponse(locale), 409)
        throw err
    }
}

exerciseRouter.patch('/:id', validator('param', idParamSchema), validator('json', updateSchema),
    (c) => updateExercise(c, c.req.valid('param').id, c.req.valid('json')))

exerciseRouter.patch('/uuid/:uuid', validator('param', uuidParamSchema), validator('json', updateSchema),
    async (c) => updateExercise(c, await ownExerciseIdByUuid(c.get('user').id, c.req.valid('param').uuid), c.req.valid('json')))

// Deletes the exercise with every log of it (and their sets): the sessions stay, without it.
// Frozen ones can be deleted too; that's how a slot is freed. Only the owner logs a custom
// exercise, so its logs are all this user's. The foreign key stays NO ACTION so that deleting
// a system exercise (admin) can't silently wipe every user's history.
async function deleteExercise(c: Context<AuthEnv>, id: number | undefined) {
    const owned = id === undefined ? undefined : await ownedExercise(c.get('user').id, id)
    if (!owned) return notFound(c)
    await db.transaction(async (tx) => {
        await tx.delete(exerciseLogs).where(eq(exerciseLogs.exerciseId, owned.id))
        await tx.delete(exercises).where(eq(exercises.id, owned.id))
    })
    return c.json({ success: true, id: owned.id, uuid: owned.uuid })
}

exerciseRouter.delete('/:id', validator('param', idParamSchema), (c) => deleteExercise(c, c.req.valid('param').id))

exerciseRouter.delete('/uuid/:uuid', validator('param', uuidParamSchema),
    async (c) => deleteExercise(c, await ownExerciseIdByUuid(c.get('user').id, c.req.valid('param').uuid)))

export default exerciseRouter;
