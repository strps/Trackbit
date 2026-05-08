import { generateCrudRouter } from '../../../lib/utilities/crud-router-factory.js'; // Adjust path if necessary
import { exerciseLogs, exercises, exercisePerformances, muscleGroups } from '../../../db/schema/index.js';
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

            //Query exercise exercises with the lastest set.

            const latestSetSubquery = db.$with("latest_sets").as(
                db.select({
                    exerciseId: sql<number>`el.exercise_id`.as('exerciseId'),
                    setId: sql<number>`es.id`.as('setId'),
                    weight: sql<number | null>`es.weight`.as('weight'),
                    reps: sql<number | null>`es.reps`.as('reps'),
                    distance: sql<number | null>`es.distance`.as('distance'),
                    duration: sql<number | null>`es.duration_miliseconds`.as('durationMilliSeconds'),
                    createdAt: sql<string | null>`es.created_at`.as('createdAt'),
                    rowNumber: sql<number>`row_number() over (partition by el.exercise_id order by es.created_at desc)`.as('row_number'),
                    rpe: sql<number | null>`es.rpe`.as('rpe'),
                })
                    .from(sql`${exerciseLogs} el`)
                    .leftJoin(sql`${exercisePerformances} es`, sql`es.exercise_log_id = el.id`)
                    .where(sql`es.id IS NOT NULL`)  // Optional: exclude rows without sets if desired
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