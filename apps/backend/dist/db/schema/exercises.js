"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exerciseSetsRelations = exports.exerciseSets = exports.exerciseLogRelations = exports.exerciseLogs = exports.exerciseSessionRelations = exports.exerciseSessions = exports.exercisesRelations = exports.exercises = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const habits_1 = require("./habits");
const user_1 = require("./user");
//Exercises
exports.exercises = (0, pg_core_1.pgTable)('exercises', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    // If NULL, it's a "System Default" exercise. If set, it's a user's custom exercise.
    userId: (0, pg_core_1.text)('user_id').references(() => user_1.user.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)('name').notNull(), // "Bench Press", "Running"
    category: (0, pg_core_1.text)('category').notNull().default('strength'), // 'strength', 'cardio', 'flexibility'
    muscleGroup: (0, pg_core_1.text)('muscle_group'), // 'chest', 'legs', 'back' - useful for analytics later
    defaultWeightUnit: (0, pg_core_1.text)('default_weight_unit').default('kg'), // 'kg' or 'lbs'
    defaultDistanceUnit: (0, pg_core_1.text)('default_distance_unit').default('km'), // 'km' or 'miles'
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.exercisesRelations = (0, drizzle_orm_1.relations)(exports.exercises, ({ many }) => ({
    exerciseSets: many(exports.exerciseSets),
}));
//Exercise Sessions
exports.exerciseSessions = (0, pg_core_1.pgTable)('exercise_sessions', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    //Foreing key columns
    habitId: (0, pg_core_1.integer)('habit_id').notNull(),
    date: (0, pg_core_1.date)('date', { mode: 'string' }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
}, (table) => [
    (0, pg_core_1.foreignKey)({
        columns: [table.habitId, table.date],
        foreignColumns: [habits_1.dayLogs.habitId, habits_1.dayLogs.date],
    }).onDelete('cascade'),
]);
exports.exerciseSessionRelations = (0, drizzle_orm_1.relations)(exports.exerciseSessions, ({ one, many }) => ({
    log: one(habits_1.dayLogs, {
        fields: [exports.exerciseSessions.habitId, exports.exerciseSessions.date],
        references: [habits_1.dayLogs.habitId, habits_1.dayLogs.date],
    }),
    exerciseLogs: many(exports.exerciseLogs),
}));
//Exercise Logs
exports.exerciseLogs = (0, pg_core_1.pgTable)('exercise_log', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    exerciseId: (0, pg_core_1.integer)('exercise_id').references(() => exports.exercises.id).notNull(),
    exerciseSessionId: (0, pg_core_1.integer)('session_id').references(() => exports.exerciseSessions.id, { onDelete: 'cascade' }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    // Cardio data
    distance: (0, pg_core_1.real)('distance'),
    duration: (0, pg_core_1.integer)('duration'), // in seconds
    //Units
    distanceUnit: (0, pg_core_1.text)('distance_unit').default('km'),
    weightUnit: (0, pg_core_1.text)('weight_unit').default('kg'),
});
exports.exerciseLogRelations = (0, drizzle_orm_1.relations)(exports.exerciseLogs, ({ one, many }) => ({
    session: one(exports.exerciseSessions, {
        fields: [exports.exerciseLogs.exerciseSessionId],
        references: [exports.exerciseSessions.id],
    }),
    exercise: one(exports.exercises, {
        fields: [exports.exerciseLogs.exerciseId],
        references: [exports.exercises.id],
    }),
    exerciseSets: many(exports.exerciseSets),
}));
//Exercise Sets 
exports.exerciseSets = (0, pg_core_1.pgTable)('exercise_sets', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    exerciseLogId: (0, pg_core_1.integer)('exercise_log_id').references(() => exports.exerciseLogs.id, { onDelete: 'cascade' }).notNull(),
    // Data points
    reps: (0, pg_core_1.integer)('reps'),
    weight: (0, pg_core_1.real)('weight'), // Use real/decimal for 22.5kg
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.exerciseSetsRelations = (0, drizzle_orm_1.relations)(exports.exerciseSets, ({ one }) => ({
    exerciseLog: one(exports.exerciseLogs, {
        fields: [exports.exerciseSets.exerciseLogId],
        references: [exports.exerciseLogs.id],
    }),
}));
//# sourceMappingURL=exercises.js.map