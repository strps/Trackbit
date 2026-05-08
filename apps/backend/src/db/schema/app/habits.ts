import { pgTable, serial, text, integer, timestamp, date, jsonb, primaryKey, pgEnum, boolean, unique } from 'drizzle-orm/pg-core';
import { user } from './user';
import { relations } from 'drizzle-orm';
import { exerciseSessions } from './exercises';
import { ColorStop } from '@trackbit/types';



export const habitTypeEnum = pgEnum('habit_type', ['count', 'complex', 'negative', 'timed', 'check'])
// Note: 'negative' type is deprecated. Use isAntiHabit boolean flag instead.
export const colorThemeEnum = pgEnum('color_scale', ["green", "blue", "orange", "purple", "rose", "fire", "custom"])

//Habits
export const habits = pgTable('habits', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  // 'count', 'complex', 'timed', 'check' (negative type is deprecated, use isAntiHabit)
  type: habitTypeEnum('type').notNull().default('count').notNull(),
  isAntiHabit: boolean('is_anti_habit').notNull().default(false),

  colorTheme: colorThemeEnum('color_theme').notNull().default('green').notNull(),
  // Defaults to a simple Green gradient
  colorStops: jsonb('color_stops').$type<ColorStop[]>().notNull().default([
    { position: 0, color: [255, 0, 0, 1] },
    { position: 0.5, color: [255, 225, 0, 1] },
    { position: 1, color: [12, 148, 62, 1] }
  ]),
  // e.g., 'book', 'dumbbell'
  icon: text('icon').notNull().default('star').notNull(),

  weeklyGoal: integer('weekly_goal').notNull().default(5).notNull(),
  dailyGoal: integer('daily_goal').notNull().default(1).notNull(),
  order: integer('sort_order').notNull().default(0),

  createdAt: timestamp('created_at').defaultNow(),
},
  (table) => [
    // Enforced as DEFERRABLE INITIALLY DEFERRED in migration 0003 so PATCH /reorder
    // can swap orders inside a transaction without intermediate-state conflicts.
    unique('habits_user_anti_order_uq').on(table.userId, table.isAntiHabit, table.order),
  ]
);

export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(user, {
    fields: [habits.userId],
    references: [user.id],
  }),
  dayLogs: many(dayLogs),
}));

//dayLogs
export const dayLogs = pgTable('day_logs',
  {
    id: serial('id').primaryKey(),
    habitId: integer('habit_id').references(() => habits.id, { onDelete: 'cascade' }).notNull(),
    rating: integer('rating'),
    notes: text('notes'),
    timeStamp: timestamp('time_stamp', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
);

export const habitLogsRelations = relations(dayLogs, ({ one, many }) => ({
  habit: one(habits, {
    fields: [dayLogs.habitId],
    references: [habits.id],
  }),
  // A log contains many sets
  exerciseSessions: many(exerciseSessions),
}));
