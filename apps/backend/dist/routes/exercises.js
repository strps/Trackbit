"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generateCrudRouter_1 = require("../lib/generateCrudRouter"); // Adjust path if necessary
const schema_1 = require("../db/schema");
const validationSchemas_1 = require("../lib/validationSchemas"); // Adjust path if necessary
const zod_1 = require("zod");
const db_1 = __importDefault(require("../db/db"));
const drizzle_orm_1 = require("drizzle-orm");
// Generate schemas tailored for exercises
const exerciseSchemas = (0, validationSchemas_1.generateCrudSchemas)(schema_1.exercises, {
    omitFromCreateUpdate: ['id', 'createdAt', 'userId',], // Server-managed fields
    omitFromSelect: ['createdAt',],
    refine: (schema) => schema.refine((data) => data.name?.trim().length > 0, { message: 'Exercise name is required', path: ['name'] }),
    idSchema: zod_1.z.number().int().positive(),
});
// Generate full CRUD router
const exerciseRouter = (0, generateCrudRouter_1.generateCrudRouter)({
    table: schema_1.exercises,
    schemas: exerciseSchemas,
    overrides: {
        list: async (c) => {
            const user = c.get('user');
            //Query exercise exercises with the lastest set.
            const latestSetSubquery = db_1.default.$with("latest_sets").as(db_1.default.select({
                exerciseId: (0, drizzle_orm_1.sql) `el.exercise_id`.as('exerciseId'),
                setId: (0, drizzle_orm_1.sql) `es.id`.as('setId'),
                weight: (0, drizzle_orm_1.sql) `es.weight`.as('weight'),
                reps: (0, drizzle_orm_1.sql) `es.reps`.as('reps'),
                createdAt: (0, drizzle_orm_1.sql) `es.created_at`.as('createdAt'),
                rowNumber: (0, drizzle_orm_1.sql) `row_number() over (partition by el.exercise_id order by es.created_at desc)`.as('row_number'),
            })
                .from((0, drizzle_orm_1.sql) `${schema_1.exerciseLogs} el`)
                .leftJoin((0, drizzle_orm_1.sql) `${schema_1.exerciseSets} es`, (0, drizzle_orm_1.sql) `es.exercise_log_id = el.id`)
                .where((0, drizzle_orm_1.sql) `es.id IS NOT NULL`) // Optional: exclude rows without sets if desired
            );
            // Main query filters to only the latest (row_number = 1)
            const result = await db_1.default
                .with(latestSetSubquery)
                .select({
                id: schema_1.exercises.id,
                name: schema_1.exercises.name,
                category: schema_1.exercises.category,
                muscleGroup: schema_1.exercises.muscleGroup,
                defaultWeightUnit: schema_1.exercises.defaultWeightUnit,
                defaultDistanceUnit: schema_1.exercises.defaultDistanceUnit,
                lastSetId: latestSetSubquery.setId,
                lastSetWeight: latestSetSubquery.weight,
                lastSetReps: latestSetSubquery.reps,
                lastSetCreatedAt: latestSetSubquery.createdAt,
            })
                .from(schema_1.exercises)
                .leftJoin(latestSetSubquery, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(latestSetSubquery.exerciseId, schema_1.exercises.id), (0, drizzle_orm_1.eq)(latestSetSubquery.rowNumber, 1)))
                .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.exercises.userId), (0, drizzle_orm_1.eq)(schema_1.exercises.userId, user.id)));
            return c.json(result);
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
exports.default = exerciseRouter;
//# sourceMappingURL=exercises.js.map