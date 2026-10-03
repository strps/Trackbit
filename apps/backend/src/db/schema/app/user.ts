import { relations, sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { habits } from "./habits";

export const user = pgTable("user", {
  id: text("id").primaryKey(),

  //admin management fields
  role: text("role").default("user").notNull(),
  banned: boolean("banned").default(false).notNull(),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires_at"),


  locale: text("locale").notNull().default("en"),
  timezone: text("timezone").notNull().default("UTC"),
  unitSystem: text("unit_system").notNull().default("metric"),
  exerciseLogCardStyle: text("exercise_log_card_style").notNull().default("classic"),
  // Canonical exercise-source key (`list:12`, `program:3`, `computed:…`) the
  // picker last used. Nullable, and null is meaningful: it *is* browse mode.
  // Dangling keys are never repaired here — every read path resolves them and
  // falls back to browse mode instead.
  preferredExerciseSource: text("preferred_exercise_source"),
  // Rest timer length after each set, unless the set's list item prescribes
  // one. 0 turns the automatic rest timer off.
  defaultRestSeconds: integer("default_rest_seconds").notNull().default(90),

  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull()
}, (table) => [
  check("user_default_rest_seconds_range", sql`${table.defaultRestSeconds} BETWEEN 0 AND 3600`),
]);
export const usersRelations = relations(user, ({ many }) => ({
  habits: many(habits),
}));