import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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

  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull()
});
export const usersRelations = relations(user, ({ many }) => ({
  habits: many(habits),
}));