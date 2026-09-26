import { generateCrudRouter } from '../../../lib/utilities/crud-router-factory.js'; // Adjust path if necessary
import { dayLogs, exerciseLogs, exercises, exercisePerformances, exerciseSessions, habits, muscleGroups } from '../../../db/schema/index.js';
import { defineCrudSchemas } from '../../../lib/utilities/drizzle-crud-schemas.js'; // Adjust path if necessary
import { z } from 'zod';
import db from "../../../db/db.js";
import { eq, isNull, or, sql, and, count } from 'drizzle-orm';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
    computeFrozenExercisesForUser,
    getEffectiveLimits,
} from '../../../lib/user-limits.js';


// Generate schemas tailored for exercises
const exerciseSchemas = defineCrudSchemas(exercises, {
    omitFromCreateUpdate: ['id', 'createdAt', 'userId',], // Server-managed fields
    omitFromSelect: ['createdAt',],
    refine: (schema) =>
        schema.extend({
            muscleGroups: z.array(z.number().int().positive())
        }).refine(
            (data: any) => !!data.name?.trim(),
            { message: 'Exercise name is required', path: ['name'] }
        ),
    idSchema: z.coerce.number().int().positive(),
});

// Generate full CRUD router
const exerciseRouter = generateCrudRouter({
    table: exercises,
    schemas: exerciseSchemas,
    primaryKeyFields: ['id'],
    overrides: {
        list: async (c: Context) => {
            const user = c.get('user')
            const locale = (c.get('locale') as string | undefined) ?? 'en'

            // Each exercise's most recent set, from this user's own logs only: system
            // exercises are shared, so an unscoped query would show other users' sets.
            const latestSetSubquery = db.$with("latest_sets").as(
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

            // Main query filters to only the latest (row_number = 1)
            const result = await db
                .with(latestSetSubquery)
                .select({
                    id: exercises.id,
                    userId: exercises.userId,
                    name: sql<string>`COALESCE(${exercises.nameI18n}->>${locale}, ${exercises.nameI18n}->>'en', ${exercises.name})`.as('name'),
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
                    }

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

            const frozen = await computeFrozenExercisesForUser(user.id, user.role)
            const annotated = result.map((row) => ({
                ...row,
                frozen: row.userId === user.id ? frozen.has(row.id) : false,
            }))

            return c.json(annotated)
        },
    },

    // Allow modification only of user-created (custom) exercises
    // Global exercises (userId === null) are read-only
    ownershipCheck: async (user, record) => {
        return record.userId === user.id;
    },

    beforeUpdate: async (c, data) => {
        const user = c.get('user')
        const id = Number(c.req.param('id'))
        const frozen = await computeFrozenExercisesForUser(user.id, user.role)
        if (frozen.has(id)) {
            throw new HTTPException(403, {
                res: new Response(
                    JSON.stringify({
                        error: 'custom_exercise_frozen',
                        message: 'This custom exercise is frozen because your role limits were reduced. Delete it or another to free a slot.',
                    }),
                    { status: 403, headers: { 'content-type': 'application/json' } }
                ),
            })
        }
        return data
    },

    beforeCreate: async (c, data) => {
        const user = c.get('user')
        const limits = await getEffectiveLimits(user.role)

        if (limits && limits.maxCustomExercises != null) {
            const [{ value: existingCount }] = await db
                .select({ value: count() })
                .from(exercises)
                .where(eq(exercises.userId, user.id))

            if (existingCount >= limits.maxCustomExercises) {
                throw new HTTPException(403, {
                    res: new Response(
                        JSON.stringify({
                            error: 'custom_exercise_limit_reached',
                            message: `You have reached the maximum of ${limits.maxCustomExercises} custom exercises for your role.`,
                            maxCustomExercises: limits.maxCustomExercises,
                        }),
                        { status: 403, headers: { 'content-type': 'application/json' } }
                    ),
                })
            }
        }

        return {
            ...data,
            userId: user.id, // Mark as custom
        }
    },
});







export default exerciseRouter;