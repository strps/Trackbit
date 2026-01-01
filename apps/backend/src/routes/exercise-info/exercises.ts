import { generateCrudRouter } from '../../lib/utilities/crud-router-factory.js'; // Adjust path if necessary
import { exerciseLogs, exercises, exercisePerformances, muscleGroups } from '../../db/schema/index.js';
import { defineCrudSchemas } from '../../lib/utilities/drizzle-crud-schemas.js'; // Adjust path if necessary
import { z } from 'zod';
import db from "../../db/db.js";
import { eq, isNull, or, sql, and } from 'drizzle-orm';
import { Context } from 'hono';


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
    idSchema: z.number().int().positive(),
});

// Generate full CRUD router
const exerciseRouter = generateCrudRouter({
    table: exercises,
    schemas: exerciseSchemas,
    primaryKeyFields: ['id'],
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
                    distance: sql<number | null>`es.distance`.as('distance'),
                    duration: sql<number | null>`es.duration_miliseconds`.as('durationMilliSeconds'),
                    createdAt: sql<string | null>`es.created_at`.as('createdAt'),
                    rowNumber: sql<number>`row_number() over (partition by el.exercise_id order by es.created_at desc)`.as('row_number'),
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
                    name: exercises.name,
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


            return c.json(result)
        },
    },

    // Allow modification only of user-created (custom) exercises
    // Global exercises (userId === null) are read-only
    ownershipCheck: async (user, record) => {
        return record.userId === user.id;
    },

    beforeCreate: async (c, data) => {

        const r = {
            ...data,
            userId: c.get('user').id, // Mark as custom
        }

        console.log(r)

        return (r)
    },
});







export default exerciseRouter;