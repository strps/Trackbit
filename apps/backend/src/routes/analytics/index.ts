// src/routes/analytics.ts
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import {
    getAnalyticsOverview,
    getExerciseProgress,
    getPersonalRecords,
    getVolumeByMuscleGroup,
    getCardioSummary,
} from './queries.js';

// Shared schemas
const dateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid date',
    });

const queryDateRangeSchema = z.object({
    startDate: dateSchema,
    endDate: dateSchema,
});

const exerciseIdParamSchema = z.object({
    exerciseId: z.string().transform((val) => Number(val)).pipe(
        z.number().int().positive('Exercise ID must be a positive integer')
    ),
});

const prsQuerySchema = z.object({
    limit: z
        .string()
        .optional()
        .transform((val) => (val ? Number(val) : 20))
        .pipe(
            z
                .number()
                .int()
                .min(1, 'Limit must be at least 1')
                .max(100, 'Limit must not exceed 100')
        ),
});

const analytics = new Hono();

analytics.use('*', requireAuth);

// GET /api/analytics/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
analytics.get(
    '/overview',
    validator('query', (value, c) => {
        const parsed = queryDateRangeSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: parsed.error.format() }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const userId = c.get('user').id;
        const { startDate, endDate } = c.req.valid('query');

        try {
            const data = await getAnalyticsOverview(userId, startDate, endDate);
            return c.json(data);
        } catch (error) {
            console.error('Analytics overview error:', error);
            return c.json({ error: 'Failed to fetch overview' }, 500);
        }
    }
);

// GET /api/analytics/progress/:exerciseId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
analytics.get(
    '/progress/:exerciseId',
    validator('param', (value, c) => {
        const parsed = exerciseIdParamSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: parsed.error.format() }, 400);
        }
        return parsed.data;
    }),
    validator('query', (value, c) => {
        const parsed = queryDateRangeSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: parsed.error.format() }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const userId = c.get('user').id;
        const { exerciseId } = c.req.valid('param');
        const { startDate, endDate } = c.req.valid('query');

        try {
            const progress = await getExerciseProgress(userId, exerciseId, startDate, endDate);
            return c.json(progress);
        } catch (error) {
            console.error('Exercise progress error:', error);
            return c.json({ error: 'Failed to fetch progress data' }, 500);
        }
    }
);

// GET /api/analytics/prs?limit=20
analytics.get(
    '/prs',
    validator('query', (value, c) => {
        const parsed = prsQuerySchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: parsed.error.format() }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const userId = c.get('user').id;
        const { limit } = c.req.valid('query');

        try {
            const prs = await getPersonalRecords(userId, limit);
            return c.json(prs);
        } catch (error) {
            console.error('Personal records error:', error);
            return c.json({ error: 'Failed to fetch personal records' }, 500);
        }
    }
);

// GET /api/analytics/volume-by-muscle?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
analytics.get(
    '/volume-by-muscle',
    validator('query', (value, c) => {
        const parsed = queryDateRangeSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: parsed.error.format() }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const userId = c.get('user').id;
        const { startDate, endDate } = c.req.valid('query');

        try {
            const volume = await getVolumeByMuscleGroup(userId, startDate, endDate);
            return c.json(volume);
        } catch (error) {
            console.error('Volume by muscle group error:', error);
            return c.json({ error: 'Failed to fetch volume data' }, 500);
        }
    }
);

// GET /api/analytics/cardio?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
analytics.get(
    '/cardio',
    validator('query', (value, c) => {
        const parsed = queryDateRangeSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: parsed.error.format() }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const userId = c.get('user').id;
        const { startDate, endDate } = c.req.valid('query');

        try {
            const summary = await getCardioSummary(userId, startDate, endDate);
            return c.json(summary);
        } catch (error) {
            console.error('Cardio summary error:', error);
            return c.json({ error: 'Failed to fetch cardio summary' }, 500);
        }
    }
);

export default analytics;