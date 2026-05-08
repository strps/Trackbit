import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { user } from "./user";
import { relations } from "drizzle-orm";

export const appSettings = pgTable("app_settings", {
    id: serial("id").primaryKey(),
    googleLoginEnabled: boolean("google_login_enabled").notNull().default(false),
    githubLoginEnabled: boolean("github_login_enabled").notNull().default(false),
    passwordLoginEnabled: boolean("password_login_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const invites = pgTable("invites", {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // e.g., crypto-random 12-char string
    email: text("email"), // Optional: target specific email
    invitedBy: text("invited_by").references(() => user.id),
    role: text("role").notNull().default("tester"),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    expiresAt: timestamp("expires_at"), // Optional expiration
    createdAt: timestamp("created_at").defaultNow(),
    consumedAt: timestamp("consumed_at"),
});

export const invitesRelations = relations(invites, ({ one }) => ({
    inviter: one(user, {
        fields: [invites.invitedBy],
        references: [user.id],
    }),
}));

export const userLimits = pgTable("user_limits", {
    id: serial("id").primaryKey(),
    role: text("role").notNull().unique(), // 'tester', potentially others
    maxHabits: integer("max_habits").default(10),
    maxCustomExercises: integer("max_custom_exercises").default(5),
    allowedHabitTypes: text("allowed_habit_types").array().default(["count", "complex"]), // array of strings
    // Extend as needed
});