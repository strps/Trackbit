"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.habitLogsRelations = exports.dayLogs = exports.habitsRelations = exports.habits = exports.habitTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const user_1 = require("./user");
const drizzle_orm_1 = require("drizzle-orm");
const exercises_1 = require("./exercises");
exports.habitTypeEnum = (0, pg_core_1.pgEnum)('habit_type', ['simple', 'complex', 'negative', 'timed']);
//Habits
exports.habits = (0, pg_core_1.pgTable)('habits', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.text)('user_id').references(() => user_1.user.id, { onDelete: 'cascade' }).notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    // 'simple', 'complex', 'negative'
    type: (0, exports.habitTypeEnum)('type').notNull().default('simple').notNull(),
    // Defaults to a simple Green gradient
    colorStops: (0, pg_core_1.jsonb)('color_palette').$type().notNull().default([
        { position: 0, color: [241, 245, 249] },
        { position: 1, color: [16, 185, 129] }
    ]),
    // e.g., 'book', 'dumbbell'
    icon: (0, pg_core_1.text)('icon').notNull().default('star').notNull(),
    weeklyGoal: (0, pg_core_1.integer)('weekly_goal').notNull().default(5).notNull(),
    dailyGoal: (0, pg_core_1.integer)('daily_goal').notNull().default(1).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.habitsRelations = (0, drizzle_orm_1.relations)(exports.habits, ({ one, many }) => ({
    user: one(user_1.user, {
        fields: [exports.habits.userId],
        references: [user_1.user.id],
    }),
    dayLogs: many(exports.dayLogs),
}));
//dayLogs
exports.dayLogs = (0, pg_core_1.pgTable)('day_logs', {
    //Multi column primary key
    habitId: (0, pg_core_1.integer)('habit_id').references(() => exports.habits.id, { onDelete: 'cascade' }).notNull(),
    date: (0, pg_core_1.date)('date', { mode: 'string' }).notNull(),
    // Overall rating of the workout (optional)
    rating: (0, pg_core_1.integer)('rating'),
    // Notes for the whole session "Felt tired today"
    notes: (0, pg_core_1.text)('notes'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
}, (table) => [(0, pg_core_1.primaryKey)({ columns: [table.habitId, table.date] })]);
exports.habitLogsRelations = (0, drizzle_orm_1.relations)(exports.dayLogs, ({ one, many }) => ({
    habit: one(exports.habits, {
        fields: [exports.dayLogs.habitId],
        references: [exports.habits.id],
    }),
    // A log contains many sets
    exerciseSessions: many(exercises_1.exerciseSessions),
}));
//# sourceMappingURL=habits.js.map