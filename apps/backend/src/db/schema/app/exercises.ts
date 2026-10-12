import { relations, sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, real, serial, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { EXERCISE_DIFFICULTIES, EXERCISE_EQUIPMENT } from "@trackbit/types";
import { exerciseListItems } from "./exercise-lists";
import { dayLogs } from "./habits";
import { user } from "./user";

export const exerciseEquipmentEnum = pgEnum('exercise_equipment', EXERCISE_EQUIPMENT)
export const exerciseDifficultyEnum = pgEnum('exercise_difficulty', EXERCISE_DIFFICULTIES)

/**
 * [list] is null or a non-empty JSON array of non-blank strings, and [i18n] is null or a non-empty
 * object of such arrays: the clients never hide an empty list or a blank entry.
 */
const stepListChecks = (name: string, list: AnyPgColumn, i18n: AnyPgColumn) => [
    check(`exercises_${name}_not_empty`, sql`${list} IS NULL OR (jsonb_typeof(${list}) = 'array' AND jsonb_array_length(${list}) > 0
        AND NOT jsonb_path_exists(${list}, '$[*] ? (@.type() != "string" || !(@ like_regex "[^[:space:]]"))'))`),
    check(`exercises_${name}_i18n_not_empty`, sql`${i18n} IS NULL OR (jsonb_typeof(${i18n}) = 'object' AND ${i18n} <> '{}'::jsonb
        AND NOT jsonb_path_exists(${i18n}, 'strict $.* ? (@.type() != "array" || @.size() == 0)')
        AND NOT jsonb_path_exists(${i18n}, '$.*[*] ? (@.type() != "string" || !(@ like_regex "[^[:space:]]"))'))`),
]

//Exercises
export const exercises = pgTable('exercises', {
    id: serial('id').primaryKey(),
    // Chosen by a client that creates the exercise offline (Android), else random; see habits.uuid.
    uuid: uuid('uuid').defaultRandom().notNull().unique(),
    // If NULL, it's a "System Default" exercise. If set, it's a user's custom exercise.
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // "Bench Press", "Running"
    // System exercises store translations here: { "en": "Bench Press", "es": "Press de banca" }
    nameI18n: jsonb('name_i18n').$type<Record<string, string>>(),
    category: text('category').notNull().default('strength'), // 'strength', 'cardio', 'flexibility'
    description: text('description'),
    descriptionI18n: jsonb('description_i18n').$type<Record<string, string>>(),
    defaultWeightUnit: text('default_weight_unit').default('kg'), // 'kg' or 'lbs'
    defaultDistanceUnit: text('default_distance_unit').default('km'), // 'km' or 'miles'
    // Ordered entries. User exercises use the plain column; system ones the translations, like name.
    instructions: jsonb('instructions').$type<string[]>(),
    instructionsI18n: jsonb('instructions_i18n').$type<Record<string, string[]>>(),
    tips: jsonb('tips').$type<string[]>(),
    tipsI18n: jsonb('tips_i18n').$type<Record<string, string[]>>(),
    commonMistakes: jsonb('common_mistakes').$type<string[]>(),
    commonMistakesI18n: jsonb('common_mistakes_i18n').$type<Record<string, string[]>>(),
    equipment: exerciseEquipmentEnum('equipment').array().notNull().default(sql`'{}'`),
    difficulty: exerciseDifficultyEnum('difficulty'),
    // The base exercise this is a variant of; null for a base. The rules a check can't hold (one
    // level deep, who may point at whom) are db/sql/exercise-variant-rules.sql's trigger.
    variantOfId: integer('variant_of_id').references((): AnyPgColumn => exercises.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
},
    (table) => [
        // User exercises: unique per (userId, name)
        uniqueIndex('unique_user_exercise_name')
            .on(table.userId, table.name)
            .where(sql`user_id IS NOT NULL`),
        // System exercises: unique on English name in the JSONB translation object
        uniqueIndex('unique_system_exercise_name')
            .on(sql`(name_i18n->>'en')`)
            .where(sql`user_id IS NULL`),
        // No description is NULL, never a blank string the clients would have to hide.
        check('exercises_description_not_blank', sql`${table.description} IS NULL OR btrim(${table.description}) <> ''`),
        ...stepListChecks('instructions', table.instructions, table.instructionsI18n),
        ...stepListChecks('tips', table.tips, table.tipsI18n),
        ...stepListChecks('common_mistakes', table.commonMistakes, table.commonMistakesI18n),
        check('exercises_variant_of_not_self', sql`${table.variantOfId} IS DISTINCT FROM ${table.id}`),
        index('exercises_variant_of_idx').on(table.variantOfId),
    ]
);

export const exercisesRelations = relations(exercises, ({ many }) => ({
    exercisePerformances: many(exercisePerformances),
}));
//========================================================
//------- Exercise information tables ------- 
//========================================================

//Muscle Groups
export const muscleGroups: any = pgTable('muscle_groups', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),                    // Display name: "Chest", "Upper Chest"
    nameI18n: jsonb('name_i18n').$type<Record<string, string>>(),
    slug: text('slug').notNull().unique(),           // URL-friendly: "chest", "upper-chest"

    // Hierarchy
    parentId: integer('parent_id')
        .references(() => muscleGroups.id, { onDelete: 'set null' }),

    // Metadata
    level: integer('level').notNull().default(1),    // 1 = Major, 2 = Subdivision, 3+ = Deep
    description: text('description'),
    descriptionI18n: jsonb('description_i18n').$type<Record<string, string>>(),
    displayOrder: integer('display_order').default(0),
    // isActive: boolean('is_active').default(true),

    createdAt: timestamp('created_at').defaultNow(),
});

export const exerciseMuscleGroups = pgTable('exercise_muscle_groups', {
    exerciseId: integer('exercise_id')
        .references(() => exercises.id, { onDelete: 'cascade' })
        .notNull(),

    muscleGroupId: integer('muscle_group_id')
        .references(() => muscleGroups.id, { onDelete: 'cascade' })
        .notNull(),

    // Targeting details
    role: text('role').notNull().default('secondary'), // 'primary' | 'secondary'
    contribution: integer('contribution').default(100), // 0–100 (optional weighting)

}, (table) => [
    primaryKey({ columns: [table.exerciseId, table.muscleGroupId] }),
]);

export const muscleGroupsRelations = relations(muscleGroups, ({ one, many }) => ({
    parent: one(muscleGroups, {
        fields: [muscleGroups.parentId],
        references: [muscleGroups.id],
    }),
    children: many(muscleGroups, {
        relationName: 'children',
    }),
    exerciseLinks: many(exerciseMuscleGroups),
}));

export const exerciseMuscleGroupsRelations = relations(exerciseMuscleGroups, ({ one }) => ({
    exercise: one(exercises, {
        fields: [exerciseMuscleGroups.exerciseId],
        references: [exercises.id],
    }),
    muscleGroup: one(muscleGroups, {
        fields: [exerciseMuscleGroups.muscleGroupId],
        references: [muscleGroups.id],
    }),
}));



// Sessions, logs and sets carry a `uuid` a client may choose when it creates the row, so an
// offline client can create a session, its logs and their sets before any of them reaches the
// server, and refer to each by an id that never changes. Rows created without one get a random one.

//Exercise Sessions
export const exerciseSessions = pgTable('exercise_sessions', {
    id: serial('id').primaryKey(),
    uuid: uuid('uuid').defaultRandom().notNull().unique(),
    dayLogId: integer('day_log_id').references(() => dayLogs.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const exerciseSessionRelations = relations(exerciseSessions, ({ one, many }) => ({
    log: one(dayLogs, {
        fields: [exerciseSessions.dayLogId],
        references: [dayLogs.id],
    }),
    exerciseLogs: many(exerciseLogs),
}));


//Exercise Logs
export const exerciseLogs = pgTable('exercise_log', {
    id: serial('id').primaryKey(),
    uuid: uuid('uuid').defaultRandom().notNull().unique(),

    exerciseId: integer('exercise_id').references(() => exercises.id).notNull(),
    exerciseSessionId: integer('session_id').references(() => exerciseSessions.id, { onDelete: 'cascade' }).notNull(),

    // Provenance: the list item this log was logged from, when it came from a
    // source queue. Set null (not cascade) on item delete so history survives
    // list edits. Null for ad-hoc logs and for computed sources.
    listItemId: integer('list_item_id')
        .references(() => exerciseListItems.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at').defaultNow(),

    // Cardio data
    distance: real('distance'),
    duration: integer('duration'), // in seconds

    //Units
    distanceUnit: text('distance_unit').default('km'),
    weightUnit: text('weight_unit').default('kg'),
})
export const exerciseLogRelations = relations(exerciseLogs, ({ one, many }) => ({
    session: one(exerciseSessions, {
        fields: [exerciseLogs.exerciseSessionId],
        references: [exerciseSessions.id],
    }),
    exercise: one(exercises, {
        fields: [exerciseLogs.exerciseId],
        references: [exercises.id],
    }),
    listItem: one(exerciseListItems, {
        fields: [exerciseLogs.listItemId],
        references: [exerciseListItems.id],
    }),
    exercisePerformances: many(exercisePerformances),
}));


//Exercise Performances 
export const exercisePerformances = pgTable('exercise_performances', {
    id: serial('id').primaryKey(),
    uuid: uuid('uuid').defaultRandom().notNull().unique(),
    exerciseLogId: integer('exercise_log_id').references(() => exerciseLogs.id, { onDelete: 'cascade' }).notNull(),

    number: integer('number').default(1).notNull(), //.notNull(),// Sequential order (1, 2, 3...)

    // Data points
    reps: integer('reps'), // For strength/bodyweight
    weight: real('weight'), // Use real/decimal for 22.5kg
    duration: integer('duration_miliseconds'), // For timed sets or laps Miliseconds
    distance: numeric('distance', { mode: "number" }),         // meters/km, for laps

    // pace: numeric('pace'),                 // Optional derived: min/km
    rpe: integer('rpe'),// Rate of Perceived Exertion (1-10)
    // isWarmup: boolean('is_warmup').default(false),
    // isDropSet: boolean('is_drop_set').default(false),


    createdAt: timestamp('created_at').defaultNow(),
});

export const Relations = relations(exercisePerformances, ({ one }) => ({
    exerciseLog: one(exerciseLogs, {
        fields: [exercisePerformances.exerciseLogId],
        references: [exerciseLogs.id],
    }),
}));

