import { relations } from "drizzle-orm";
import { boolean, foreignKey, integer, numeric, pgTable, primaryKey, real, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { dayLogs } from "./habits";
import { user } from "./user";

//Exercises
export const exercises = pgTable('exercises', {
    id: serial('id').primaryKey(),
    // If NULL, it's a "System Default" exercise. If set, it's a user's custom exercise.
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // "Bench Press", "Running"
    category: text('category').notNull().default('strength'), // 'strength', 'cardio', 'flexibility'
    description: text('description'),
    defaultWeightUnit: text('default_weight_unit').default('kg'), // 'kg' or 'lbs'
    defaultDistanceUnit: text('default_distance_unit').default('km'), // 'km' or 'miles'
    createdAt: timestamp('created_at').defaultNow(),
},
    (table) => [
        unique('unique_user_exercise_name').on(table.userId, table.name),
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
    slug: text('slug').notNull().unique(),           // URL-friendly: "chest", "upper-chest"

    // Hierarchy
    parentId: integer('parent_id')
        .references(() => muscleGroups.id, { onDelete: 'set null' }),

    // Metadata
    level: integer('level').notNull().default(1),    // 1 = Major, 2 = Subdivision, 3+ = Deep
    description: text('description'),
    displayOrder: integer('display_order').default(0),
    // isActive: boolean('is_active').default(true),

    createdAt: timestamp('created_at').defaultNow(),
});

export const exerciseMuscleGroups = pgTable('exercise_muscle_group', {
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



//Exercise Sessions
export const exerciseSessions = pgTable('exercise_sessions', {
    id: serial('id').primaryKey(),
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

    exerciseId: integer('exercise_id').references(() => exercises.id).notNull(),
    exerciseSessionId: integer('session_id').references(() => exerciseSessions.id, { onDelete: 'cascade' }).notNull(),

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
    exercisePerformances: many(exercisePerformances),
}));


//Exercise Performances 
export const exercisePerformances = pgTable('exercise_performances', {
    id: serial('id').primaryKey(),
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

