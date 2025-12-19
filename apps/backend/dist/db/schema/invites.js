"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appLimits = exports.invitesRelations = exports.invites = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const user_1 = require("./user");
const drizzle_orm_1 = require("drizzle-orm");
exports.invites = (0, pg_core_1.pgTable)("invites", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    code: (0, pg_core_1.text)("code").notNull().unique(), // e.g., crypto-random 12-char string
    email: (0, pg_core_1.text)("email"), // Optional: target specific email
    invitedBy: (0, pg_core_1.text)("invited_by").references(() => user_1.user.id),
    role: (0, pg_core_1.text)("role").notNull().default("tester"),
    maxUses: (0, pg_core_1.integer)("max_uses").notNull().default(1),
    uses: (0, pg_core_1.integer)("uses").notNull().default(0),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"), // Optional expiration
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    consumedAt: (0, pg_core_1.timestamp)("consumed_at"),
});
exports.invitesRelations = (0, drizzle_orm_1.relations)(exports.invites, ({ one }) => ({
    inviter: one(user_1.user, {
        fields: [exports.invites.invitedBy],
        references: [user_1.user.id],
    }),
}));
exports.appLimits = (0, pg_core_1.pgTable)("app_limits", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    role: (0, pg_core_1.text)("role").notNull().unique(), // 'tester', potentially others
    maxHabits: (0, pg_core_1.integer)("max_habits").default(10),
    maxCustomExercises: (0, pg_core_1.integer)("max_custom_exercises").default(5),
    allowedHabitTypes: (0, pg_core_1.text)("allowed_habit_types").array().default(["simple", "complex"]), // array of strings
    // Extend as needed
});
//# sourceMappingURL=invites.js.map