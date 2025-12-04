import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, or, isNull } from 'drizzle-orm';
import { requireAuth } from '../../utils/auth';
import db from '../../db/db';
import { exercises } from '../../db/schema/exercises';

const exerciseRoutes: FastifyPluginAsyncZod = async (app) => {
    app.addHook('preHandler', requireAuth);

    // GET /api/exercises - List Available Exercises
    app.get('/', async (request) => {
        const user = (request as any).user;

        // Fetch "System Defaults" (userId is NULL) OR "My Custom Exercises"
        const result = await db.select().from(exercises).where(
            or(
                isNull(exercises.userId),
                eq(exercises.userId, user.id)
            )
        );
        return result;
    });

    // POST /api/exercises - Create Custom Exercise
    app.post('/', {
        schema: {
            body: z.object({
                name: z.string().min(1),
                category: z.string().default('strength'),
                muscleGroup: z.string().optional()
            })
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { name, category, muscleGroup } = request.body;

        const result = await db.insert(exercises).values({
            name,
            category,
            muscleGroup,
            userId: user.id // Mark as custom
        }).returning();

        return reply.status(201).send(result[0]);
    });
}

export default exerciseRoutes;