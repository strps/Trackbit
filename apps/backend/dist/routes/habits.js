"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const zod_validator_1 = require("@hono/zod-validator");
const zod_1 = require("zod");
const db_1 = __importDefault(require("../db/db"));
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const app = new hono_1.Hono();
// Apply Auth Middleware to all routes in this file
app.use('*', auth_1.requireAuth);
// GET /api/habits
app.get('/', async (c) => {
    const user = c.get('user');
    const result = await db_1.default.select()
        .from(schema_1.habits)
        .where((0, drizzle_orm_1.eq)(schema_1.habits.userId, user.id))
        .orderBy((0, drizzle_orm_1.desc)(schema_1.habits.createdAt));
    return c.json(result);
});
// POST /api/habits
app.post('/', (0, zod_validator_1.zValidator)('json', zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['simple', 'complex', 'negative']).default('simple'),
    goal: zod_1.z.number().int().min(1).max(7).default(5),
    dailyGoal: zod_1.z.number().default(1),
    // Validate the JSONB structure if you want, or just accept array
    colorStops: zod_1.z.array(zod_1.z.object({
        position: zod_1.z.number(),
        color: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number()])
    })).optional(),
    icon: zod_1.z.string().default('star'),
})), async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json'); // Type-safe body from Zod
    const result = await db_1.default.insert(schema_1.habits).values({
        ...body,
        userId: user.id
    }).returning();
    return c.json(result[0], 201);
});
// PUT /api/habits/:id
app.put('/:id', (0, zod_validator_1.zValidator)('json', zod_1.z.object({
    name: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    goal: zod_1.z.number().optional(),
    colorStops: zod_1.z.any().optional(), // Simplify validation for now
    icon: zod_1.z.string().optional(),
    type: zod_1.z.enum(['simple', 'complex', 'negative']).optional(),
})), async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    console.log(c.req.valid('json'));
    const updates = c.req.valid('json');
    const result = await db_1.default.update(schema_1.habits)
        .set(updates)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.habits.id, id), (0, drizzle_orm_1.eq)(schema_1.habits.userId, user.id)))
        .returning();
    if (result.length === 0) {
        return c.json({ error: "Habit not found" }, 404);
    }
    return c.json(result[0]);
});
// DELETE /api/habits/:id
app.delete('/:id', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const result = await db_1.default.delete(schema_1.habits)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.habits.id, id), (0, drizzle_orm_1.eq)(schema_1.habits.userId, user.id)))
        .returning();
    if (result.length === 0) {
        return c.json({ error: "Habit not found" }, 404);
    }
    return c.json({ success: true, deletedId: id });
});
exports.default = app;
//# sourceMappingURL=habits.js.map