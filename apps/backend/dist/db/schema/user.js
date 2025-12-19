"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRelations = exports.user = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const habits_1 = require("./habits");
exports.user = (0, pg_core_1.pgTable)("user", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    role: (0, pg_core_1.text)("role").default("user").notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    emailVerified: (0, pg_core_1.boolean)("email_verified").notNull(),
    image: (0, pg_core_1.text)("image"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull()
});
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.user, ({ many }) => ({
    habits: many(habits_1.habits),
}));
//# sourceMappingURL=user.js.map