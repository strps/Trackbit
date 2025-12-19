"use strict";
// backend/src/routes/exercise-sessions.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generateCrudRouter_1 = require("../lib/generateCrudRouter");
const validationSchemas_1 = require("../lib/validationSchemas");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = __importDefault(require("../db/db"));
const sessionSchemas = (0, validationSchemas_1.generateCrudSchemas)(schema_1.exerciseSessions, {
    omitFromCreateUpdate: ['id', 'createdAt'],
});
const sessionRouter = (0, generateCrudRouter_1.generateCrudRouter)({
    table: schema_1.exerciseSessions,
    schemas: sessionSchemas,
    // Enforce ownership: session belongs to a dayLog of a habit owned by the user
    ownershipCheck: async (user, record) => {
        const habit = await db_1.default
            .select()
            .from(schema_1.habits)
            .where((0, drizzle_orm_1.eq)(schema_1.habits.id, record.habitId))
            .limit(1);
        return habit.length > 0 && habit[0].userId === user.id;
    },
    beforeCreate: async (c, data) => {
        // Optional: additional validation or defaults
        return data;
    },
});
exports.default = sessionRouter;
//# sourceMappingURL=sessions.js.map