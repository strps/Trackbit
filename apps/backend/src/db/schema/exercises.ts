import { relations } from "drizzle-orm";
import { date, foreignKey, integer, pgTable, primaryKey, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { dayLogs } from "./habits.ts";
import { user } from "./user.ts";
import { de } from "zod/v4/locales";

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
});
export const exercisesRelations = relations(exercises, ({ many }) => ({
    exerciseSets: many(exerciseSets),
}));
//========================================================
//------- Exercise information tables ------- 
//========================================================

//Muscle Groups
export const muscleGroups = pgTable('muscle_groups', {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(), // e.g., 'chest', 'back', 'quadriceps'
    description: text('description'),
});

export const exerciseMuscleGroup = pgTable('exercise_muscle_group', {
    exerciseId: integer('exercise_id').references(() => exercises.id, { onDelete: 'cascade' }).notNull(),
    muscleGroupId: integer('muscle_group_id').references(() => muscleGroups.id, { onDelete: 'cascade' }).notNull(),
}, (table) => [
    foreignKey({
        columns: [table.exerciseId],
        foreignColumns: [exercises.id],
    }),
    foreignKey({
        columns: [table.muscleGroupId],
        foreignColumns: [muscleGroups.id],
    }),
    primaryKey({ columns: [table.exerciseId, table.muscleGroupId] }),
]);

export const exerciseMuscleGroupRelations = relations(exerciseMuscleGroup, ({ one }) => ({
    exercise: one(exercises, {
        fields: [exerciseMuscleGroup.exerciseId],
        references: [exercises.id],
    }),
    muscleGroup: one(muscleGroups, {
        fields: [exerciseMuscleGroup.muscleGroupId],
        references: [muscleGroups.id],
    }),
}));








//Exercise Sessions
export const exerciseSessions = pgTable('exercise_sessions', {
    id: serial('id').primaryKey(),

    //Foreing key columns
    habitId: integer('habit_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),

    createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
    foreignKey({
        columns: [table.habitId, table.date],
        foreignColumns: [dayLogs.habitId, dayLogs.date],
    }).onDelete('cascade'),
]
);

export const exerciseSessionRelations = relations(exerciseSessions, ({ one, many }) => ({
    log: one(dayLogs, {
        fields: [exerciseSessions.habitId, exerciseSessions.date],
        references: [dayLogs.habitId, dayLogs.date],
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
    exerciseSets: many(exerciseSets),
}));


//Exercise Sets 
export const exerciseSets = pgTable('exercise_sets', {
    id: serial('id').primaryKey(),
    exerciseLogId: integer('exercise_log_id').references(() => exerciseLogs.id, { onDelete: 'cascade' }).notNull(),

    // Data points
    reps: integer('reps'),
    weight: real('weight'), // Use real/decimal for 22.5kg

    createdAt: timestamp('created_at').defaultNow(),
});

export const exerciseSetsRelations = relations(exerciseSets, ({ one }) => ({
    exerciseLog: one(exerciseLogs, {
        fields: [exerciseSets.exerciseLogId],
        references: [exerciseLogs.id],
    }),
}));

//Exercise Laps (for activities like running, swimming)
export const exerciseLaps = pgTable('exercise_laps', {
    id: serial('id').primaryKey(),
    exerciseLogId: integer('exercise_log_id').references(() => exerciseLogs.id, { onDelete: 'cascade' }).notNull(),
    lapNumber: integer('lap_number').notNull(),
    distance: real('distance').notNull(), // in km or miles
    duration: integer('duration').notNull(), // in seconds
    createdAt: timestamp('created_at').defaultNow(),
});

export const exerciseLapsRelations = relations(exerciseLaps, ({ one }) => ({
    exerciseLog: one(exerciseLogs, {
        fields: [exerciseLaps.exerciseLogId],
        references: [exerciseLogs.id],
    }),
}));

//Exercise Intervals (for interval training sessions)
export const exerciseIntervals = pgTable('exercise_intervals', {
    id: serial('id').primaryKey(),
    exerciseLogId: integer('exercise_log_id').references(() => exerciseLogs.id, { onDelete: 'cascade' }).notNull(),
    intervalNumber: integer('interval_number').notNull(),
    workDuration: integer('work_duration').notNull(), // in seconds
    restDuration: integer('rest_duration').notNull(), // in seconds
    createdAt: timestamp('created_at').defaultNow(),
});

export const exerciseIntervalsRelations = relations(exerciseIntervals, ({ one }) => ({
    exerciseLog: one(exerciseLogs, {
        fields: [exerciseIntervals.exerciseLogId],
        references: [exerciseLogs.id],
    }),
}));