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
app.use('*', auth_1.requireAuth);
// GET /api/logs/history - Fetch all logs for the user (for Heatmap)
app.get('/history', async (c) => {
    const user = c.get('user');
    // 1. Get all user's habit IDs
    const userHabits = await db_1.default.select({ id: schema_1.habits.id }).from(schema_1.habits).where((0, drizzle_orm_1.eq)(schema_1.habits.userId, user.id));
    if (userHabits.length === 0)
        return c.json([]);
    const habitsWithLogs = await db_1.default.query.habits.findMany({
        where: (habits) => (0, drizzle_orm_1.eq)(habits.userId, user.id),
        with: {
            dayLogs: {
                with: {
                    exerciseSessions: {
                        with: {
                            exerciseLogs: {
                                with: {
                                    exerciseSets: true //TODO: we need to order the sets according to createdAt
                                }
                            }
                        }
                    }
                }
            }
        }
    });
    return c.json(habitsWithLogs);
});
app.post('/check', (0, zod_validator_1.zValidator)('json', zod_1.z.object({
    habitId: zod_1.z.number(),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    rating: zod_1.z.number(),
})), 
//TODO: check for user id in habit in oreder to make sure the user can only update own.
async (c) => {
    const { habitId, date, rating } = c.req.valid('json');
    // Check if log exists
    const existing = await db_1.default.query.dayLogs.findFirst({
        where: (logs) => (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(logs.habitId, habitId), (0, drizzle_orm_1.eq)(logs.date, date)),
    });
    if (existing) {
        // Update using composite key
        await db_1.default
            .update(schema_1.dayLogs)
            .set({ rating })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.dayLogs.habitId, habitId), (0, drizzle_orm_1.eq)(schema_1.dayLogs.date, date)));
        return c.json({
            success: true,
            habitId,
            date,
        });
    }
    else {
        // Insert new log
        await db_1.default.insert(schema_1.dayLogs).values({ habitId, date, rating });
        return c.json({
            success: true,
            habitId,
            date,
        });
    }
});
// --- GRANULAR WORKOUT LOGGING ---
// 1. Ensure Session Exists (Call this when starting a workout)
app.post('/exercise-sessions', (0, zod_validator_1.zValidator)('json', zod_1.z.object({
    habitId: zod_1.z.number(),
    date: zod_1.z.string(),
})), async (c) => {
    const { habitId, date } = c.req.valid('json');
    return await db_1.default.transaction(async (tx) => {
        // Ensure DayLog Wrapper
        const existingDayLog = await tx.query.dayLogs.findFirst({
            where: (l) => (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(l.habitId, habitId), (0, drizzle_orm_1.eq)(l.date, date))
        });
        if (!existingDayLog) {
            const hres = await tx.insert(schema_1.dayLogs).values({ habitId, date }).returning();
        }
        const hres = existingDayLog;
        const res = await tx.insert(schema_1.exerciseSessions).values({ habitId, date }).returning();
        return c.json(res[0]);
    });
});
// 2. Add/Remove Exercises
app.post('/exercise-logs', (0, zod_validator_1.zValidator)('json', zod_1.z.object({
    sessionId: zod_1.z.number(),
    exerciseId: zod_1.z.number(),
})), async (c) => {
    const body = c.req.valid('json');
    const res = await db_1.default.insert(schema_1.exerciseLogs).values({
        exerciseSessionId: body.sessionId,
        exerciseId: body.exerciseId
    }).returning();
    return c.json(res[0]);
});
app.post('/exercise-log', (0, zod_validator_1.zValidator)('json', zod_1.z.object({
    sessionId: zod_1.z.number(),
    exerciseId: zod_1.z.number(),
    // New: Accepts an array of sets immediately
    exerciseSets: zod_1.z.array(zod_1.z.object({
        reps: zod_1.z.number(),
        weight: zod_1.z.number(),
    })).optional(),
})), async (c) => {
    const body = c.req.valid('json');
    return await db_1.default.transaction(async (tx) => {
        // 1. Create the Exercise Log Header
        const logRes = await tx.insert(schema_1.exerciseLogs).values({
            exerciseSessionId: body.sessionId,
            exerciseId: body.exerciseId
        }).returning();
        const newLogId = logRes[0].id;
        // 2. Prepare Sets
        // If sets provided, use them. If not, create 1 default empty set.
        const setsToInsert = (body.exerciseSets && body.exerciseSets.length > 0)
            ? body.exerciseSets
            : [{ reps: 0, weight: 0 }];
        // 3. Insert Sets
        const setRes = await tx.insert(schema_1.exerciseSets).values(setsToInsert.map(s => ({
            exerciseLogId: newLogId,
            reps: s.reps,
            weight: s.weight,
        }))).returning();
        // 4. Return combined structure
        return c.json({
            ...logRes[0],
            sets: setRes
        });
    });
});
app.delete('/exercise-logs/:id', async (c) => {
    const id = Number(c.req.param('id'));
    await db_1.default.delete(schema_1.exerciseLogs).where((0, drizzle_orm_1.eq)(schema_1.exerciseLogs.id, id));
    return c.json({ success: true, id });
});
// 3. Add/Update/Remove Sets
app.post('/exercise-set', (0, zod_validator_1.zValidator)('json', zod_1.z.object({
    id: zod_1.z.number().optional(), // If present, update
    exerciseLogId: zod_1.z.number(),
    reps: zod_1.z.number(),
    weight: zod_1.z.number(),
})), async (c) => {
    const body = c.req.valid('json');
    if (body.id) {
        const res = await db_1.default.update(schema_1.exerciseSets)
            .set({ reps: body.reps, weight: body.weight })
            .where((0, drizzle_orm_1.eq)(schema_1.exerciseSets.id, body.id))
            .returning();
        return c.json(res[0]);
    }
    else {
        const res = await db_1.default.insert(schema_1.exerciseSets)
            .values({
            exerciseLogId: body.exerciseLogId,
            reps: body.reps,
            weight: body.weight
        })
            .returning();
        return c.json(res[0]);
    }
});
app.delete('/exercise-set/:id', async (c) => {
    const id = Number(c.req.param('id'));
    await db_1.default.delete(schema_1.exerciseSets).where((0, drizzle_orm_1.eq)(schema_1.exerciseSets.id, id));
    return c.json({ success: true, id });
});
exports.default = app;
//# sourceMappingURL=logs.js.map