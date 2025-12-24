import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { habits } from "./habits.js";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  role: text("role").default("user").notNull(),
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