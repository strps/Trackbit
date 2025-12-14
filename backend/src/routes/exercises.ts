import { generateCrudRouter } from '../lib/generateCrudRouter'; // Adjust path if necessary
import { exerciseLogs, exercises, exerciseSets } from '../db/schema';
import { generateCrudSchemas } from '../lib/validationSchemas'; // Adjust path if necessary
import { z } from 'zod';
import db from '../db/db';
import { eq, isNull, or, sql, and } from 'drizzle-orm';
import { Context } from 'hono';
import { HandlerResponse } from 'hono/types';

// Generate schemas tailored for exercises
const exerciseSchemas = generateCrudSchemas(exercises, {
    omitFromCreateUpdate: ['id', 'createdAt', 'userId',], // Server-managed fields
    omitFromSelect: ['createdAt',],
    refine: (schema) =>
        schema.refine(
            (data) => data.name?.trim().length > 0,
            { message: 'Exercise name is required', path: ['name'] }
        ),
    idSchema: z.number().int().positive(),
});

// Generate full CRUD router
const exerciseRouter = generateCrudRouter({
    table: exercises,
    schemas: exerciseSchemas,
    overrides: {
        list: async (c: Context) => {
            const user = c.get('user')

            //Query exercise exercises with the lastest set.

            const latestSetSubquery = db.$with("latest_sets").as(
                db.select({
                    exerciseId: sql<number>`el.exercise_id`.as('exerciseId'),
                    setId: sql<number>`es.id`.as('setId'),
                    weight: sql<number | null>`es.weight`.as('weight'),
                    reps: sql<number | null>`es.reps`.as('reps'),
                    createdAt: sql<string | null>`es.created_at`.as('createdAt'),
                    rowNumber: sql<number>`row_number() over (partition by el.exercise_id order by es.created_at desc)`.as('row_number'),
                })
                    .from(sql`${exerciseLogs} el`)
                    .leftJoin(sql`${exerciseSets} es`, sql`es.exercise_log_id = el.id`)
                    .where(sql`es.id IS NOT NULL`)  // Optional: exclude rows without sets if desired
            );

            // Main query filters to only the latest (row_number = 1)
            const result = await db
                .with(latestSetSubquery)
                .select({
                    id: exercises.id,
                    name: exercises.name,
                    category: exercises.category,
                    muscleGroup: exercises.muscleGroup,
                    defaultWeightUnit: exercises.defaultWeightUnit,
                    defaultDistanceUnit: exercises.defaultDistanceUnit,

                    lastSetId: latestSetSubquery.setId,
                    lastSetWeight: latestSetSubquery.weight,
                    lastSetReps: latestSetSubquery.reps,
                    lastSetCreatedAt: latestSetSubquery.createdAt,
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


            return c.json(result)
        },
    },
    ownershipCheck: async (user, record) => {
        // Allow modification only of user-created (custom) exercises
        // Global exercises (userId === null) are read-only
        return record.userId === user.id;
    },
    beforeCreate: async (c, data) => ({
        ...data,
        userId: c.get('user').id, // Mark as custom
    }),
    // Optional: Add beforeUpdate if additional logic is needed
});

export default exerciseRouter;