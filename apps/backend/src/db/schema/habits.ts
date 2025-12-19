import { pgTable, serial, text, integer, timestamp, date, jsonb, primaryKey, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './user';
import { relations } from 'drizzle-orm';
import { exerciseSessions } from './exercises';
import { ColorStop } from '../types';

export const habitTypeEnum = pgEnum('habit_type', ['simple', 'complex', 'negative', 'timed'])

//Habits
export const habits = pgTable('habits', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  // 'simple', 'complex', 'negative'
  type: habitTypeEnum('type').notNull().default('simple').notNull(),

  // Defaults to a simple Green gradient
  colorStops: jsonb('color_palette').$type<ColorStop[]>().notNull().default([
    { position: 0, color: [241, 245, 249] },
    { position: 1, color: [16, 185, 129] }
  ]),
  // e.g., 'book', 'dumbbell'
  icon: text('icon').notNull().default('star').notNull(),

  weeklyGoal: integer('weekly_goal').notNull().default(5).notNull(),
  dailyGoal: integer('daily_goal').notNull().default(1).notNull(),

  createdAt: timestamp('created_at').defaultNow(),
});

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
    //Multi column primary key
    habitId: integer('habit_id').references(() => habits.id, { onDelete: 'cascade' }).notNull(),
    date: date('date', { mode: 'string' }).notNull(),

    // Overall rating of the workout (optional)
    rating: integer('rating'),

    // Notes for the whole session "Felt tired today"
    notes: text('notes'),

    createdAt: timestamp('created_at').defaultNow(),

  },

  (table) => [primaryKey({ columns: [table.habitId, table.date] })]
);

export const habitLogsRelations = relations(dayLogs, ({ one, many }) => ({
  habit: one(habits, {
    fields: [dayLogs.habitId],
    references: [habits.id],
  }),
  // A log contains many sets
  exerciseSessions: many(exerciseSessions),
}));
