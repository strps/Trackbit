import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { dayLogs, exerciseSets, habits } from '../../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { requireAuth } from '../../utils/auth';
import db from '../../db/db';

const logRoutes: FastifyPluginAsyncZod = async (app) => {
    app.addHook('preHandler', requireAuth);

    // GET /api/logs/history - Fetch all logs for the user (for Heatmap)
    app.get('/history', async (request) => {
        const user = (request as any).user;

        // 1. Get all user's habit IDs
        const userHabits = await db.select({ id: habits.id }).from(habits).where(eq(habits.userId, user.id));

        if (userHabits.length === 0) return [];

        // 2. Fetch logs for these habits
        // We fetch enough info to render the heatmap and summaries
        const logs = await db.query.dayLogs.findMany({
            where: (logs, { inArray }) => inArray(logs.habitId, userHabits.map(h => h.id)),
            columns: {
                id: true,
                habitId: true,
                date: true,
                // value: true,
                rating: true,
                notes: true
            },
            with: {
                sets: true // Include sets for workout summaries
            }
        });

        return logs;
    });

    // POST /api/logs/check - For Simple & Negative Habits
    app.post('/check', {
        schema: {
            body: z.object({
                habitId: z.number(),
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                value: z.number(),
            })
        }
    }, async (request, reply) => {
        const { habitId, date, value } = request.body;

        const existing = await db.query.dayLogs.findFirst({
            where: (logs, { eq, and }) => and(eq(logs.habitId, habitId), eq(logs.date, date))
        });

        if (existing) {
            await db.update(dayLogs).set({ value }).where(eq(dayLogs.id, existing.id));
            return { success: true, id: existing.id };
        } else {
            const res = await db.insert(dayLogs).values({ habitId, date, value }).returning();
            return { success: true, id: res[0].id };
        }
    });

    // POST /api/logs/workout - For Complex Habits
    app.post('/workout', {
        schema: {
            body: z.object({
                id: z.number().optional(), // If provided, it's an update
                habitId: z.number(),
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                notes: z.string().optional(),
                rating: z.number().optional(),
                sets: z.array(z.object({
                    exerciseId: z.number(),
                    setNumber: z.number(),
                    reps: z.number().optional(),
                    weight: z.number().optional(),
                    weightUnit: z.string().default('kg'),
                    distance: z.number().optional(),
                    duration: z.number().optional()
                }))
            })
        }
    }, async (request, reply) => {
        const { id, habitId, date, notes, rating, sets } = request.body;
        let logId = id;

        // 1. Create or Update Header
        if (logId) {
            await db.update(dayLogs).set({ notes, rating }).where(eq(dayLogs.id, logId));
            // For simplicity in MVP, delete old sets and re-insert new ones
            await db.delete(exerciseSets).where(eq(exerciseSets.habitLogId, logId));
        } else {
            const res = await db.insert(dayLogs).values({
                habitId,
                date,
                notes,
                rating,
                value: 1
            }).returning();
            logId = res[0].id;
        }

        // 2. Insert Sets
        if (sets.length > 0 && logId) {
            await db.insert(exerciseSets).values(sets.map(s => ({
                habitLogId: logId!,
                exerciseId: s.exerciseId,
                setNumber: s.setNumber,
                reps: s.reps,
                weight: s.weight,
                weightUnit: s.weightUnit,
                distance: s.distance,
                duration: s.duration
            })));
        }

        return { success: true, logId };
    });
}

export default logRoutes;