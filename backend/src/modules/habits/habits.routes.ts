import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { habits } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../../utils/auth';
import db from '../../db/db';

const habitRoutes: FastifyPluginAsyncZod = async (app) => {
  // 1. Global Hook: Protect all routes in this file
  app.addHook('preHandler', requireAuth);

  // GET /api/habits - List all habits for the logged-in user
  app.get('/', async (request) => {
    const user = (request as any).user;

    // Return habits sorted by newest first
    const result = await db.select()
      .from(habits)
      .where(eq(habits.userId, user.id))
      .orderBy(desc(habits.createdAt));

    return result;
  });

  // POST /api/habits - Create a new habit
  app.post(
    '/',
    {
      schema: {
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          type: z.enum(['simple', 'complex', 'negative']).default('simple'),
          weeklyGoal: z.number().int().min(1).max(7).default(5),
          dailyGoal: z.number().int().min(1).max(7).default(5),
          colorStops: z.string().default('emerald'),
          icon: z.string().default('star'),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { name, description, type, weeklyGoal, dailyGoal, colorStops, icon } = request.body;

      const result = await db.insert(habits).values({
        name,
        description,
        type,
        weeklyGoal,
        dailyGoal,
        colorStops,
        userId: user.id,
        icon
      }).returning();

      return reply.status(201).send(result[0]);
    }
  );

  // PUT /api/habits/:id - Update an existing habit
  app.put(
    '/:id',
    {
      schema: {
        params: z.object({ id: z.coerce.number() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          goal: z.number().int().min(1).max(7).optional(),
          color: z.string().optional(),
          icon: z.string().optional(),
          // Note: We typically don't allow changing 'type' (e.g. Simple -> Complex) 
          // after creation because it would break existing logs.
        })
      }
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params;
      const updates = request.body;

      // Ensure the habit belongs to the user before updating
      const result = await db.update(habits)
        .set(updates)
        .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
        .returning();

      if (result.length === 0) {
        return reply.status(404).send({ error: "Habit not found or access denied" });
      }

      return result[0];
    }
  );

  // DELETE /api/habits/:id - Delete a habit
  app.delete(
    '/:id',
    {
      schema: { params: z.object({ id: z.coerce.number() }) }
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params;

      // Cascading delete in Postgres will automatically remove associated logs
      const result = await db.delete(habits)
        .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
        .returning();

      if (result.length === 0) {
        return reply.status(404).send({ error: "Habit not found or access denied" });
      }

      return { success: true, deletedId: id };
    }
  )
};

export default habitRoutes;