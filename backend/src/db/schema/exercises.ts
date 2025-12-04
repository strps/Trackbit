import { relations } from "drizzle-orm";
import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { dayLogs } from "./habits";
import { user } from "./user";


export const exercises = pgTable('exercises', {
    id: serial('id').primaryKey(),

    // If NULL, it's a "System Default" exercise. If set, it's a user's custom exercise.
    userId: text('user_id').references(() => user.id),

    name: text('name').notNull(), // "Bench Press", "Running"
    category: text('category').notNull().default('strength'), // 'strength', 'cardio', 'flexibility'
    muscleGroup: text('muscle_group'), // 'chest', 'legs', 'back' - useful for analytics later

    createdAt: timestamp('created_at').defaultNow(),
});

export const exerciseSets = pgTable('exercise_sets', {
    id: serial('id').primaryKey(),

    // Link to the specific workout session (log)
    habitLogId: integer('habit_log_id').references(() => dayLogs.id, { onDelete: 'cascade' }).notNull(),

    // Link to the exercise definition
    exerciseId: integer('exercise_id').references(() => exercises.id).notNull(),

    // 1, 2, 3...
    setNumber: integer('set_number').notNull(),

    // Data points
    reps: integer('reps'),
    weight: real('weight'), // Use real/decimal for 22.5kg
    weightUnit: text('weight_unit').default('kg'), // 'kg' or 'lbs'

    // Cardio data
    distance: real('distance'),
    duration: integer('duration'), // in seconds

    createdAt: timestamp('created_at').defaultNow(),
});


export const exercisesRelations = relations(exercises, ({ many }) => ({
    sets: many(exerciseSets),
}));

export const exerciseSetsRelations = relations(exerciseSets, ({ one }) => ({
    log: one(dayLogs, {
        fields: [exerciseSets.habitLogId],
        references: [dayLogs.id],
    }),
    exercise: one(exercises, {
        fields: [exerciseSets.exerciseId],
        references: [exercises.id],
    }),
}));