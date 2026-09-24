import { pgTable, serial, text, integer, timestamp, date, jsonb, primaryKey, pgEnum, boolean, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './user';
import { relations } from 'drizzle-orm';
import { exerciseSessions } from './exercises';
import { COLOR_THEMES, GRADIENT_PRESET_STOPS, type ColorStop } from '@trackbit/types';



export const habitTypeEnum = pgEnum('habit_type', ['count', 'complex', 'negative', 'timed', 'check'])
// Note: 'negative' type is deprecated. Use isAntiHabit boolean flag instead.
export const colorThemeEnum = pgEnum('color_scale', COLOR_THEMES)

// Canonical fallback gradient. Used as the column default, the create-route
// default, and the backfill for legacy rows so every habit always carries a
// non-empty colorStops array (an empty one crashes the gradient renderer).
export const DEFAULT_COLOR_STOPS: ColorStop[] = GRADIENT_PRESET_STOPS.custom

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
  colorStops: jsonb('color_stops').$type<ColorStop[]>().notNull().default(DEFAULT_COLOR_STOPS),
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
    // The user's calendar day this log belongs to, fixed at write time from the
    // user's stored timezone (or an explicit day). One log per habit per day.
    localDay: date('local_day', { mode: 'string' }).notNull(),
    timeStamp: timestamp('time_stamp', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('day_logs_habit_day_uq').on(t.habitId, t.localDay)],
);

export const habitLogsRelations = relations(dayLogs, ({ one, many }) => ({
  habit: one(habits, {
    fields: [dayLogs.habitId],
    references: [habits.id],
  }),
  // A log contains many sets
  exerciseSessions: many(exerciseSessions),
}));
