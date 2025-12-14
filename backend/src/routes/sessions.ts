// backend/src/routes/exercise-sessions.ts

import { generateCrudRouter } from '../lib/generateCrudRouter';
import { generateCrudSchemas } from '../lib/validationSchemas';
import { dayLogs, exerciseSessions, habits } from '../db/schema';
import { eq } from 'drizzle-orm';
import db from '../db/db';
import z from 'zod';

const sessionSchemas = generateCrudSchemas(exerciseSessions, {
    omitFromCreateUpdate: ['id', 'createdAt'],
    // No fields to omit from select
    omitFromSelect: [],
    idSchema: z.number().int().positive(),
});

const sessionRouter = generateCrudRouter({
    table: exerciseSessions,
    schemas: sessionSchemas,
    // Enforce ownership: session belongs to a dayLog of a habit owned by the user
    ownershipCheck: async (user, record) => {
        // Find the habit associated with this session
        const dayLog = await db
            .select()
            .from(dayLogs)
            .where(eq(dayLogs.id, record.dayLogId))
            .limit(1);

        if (dayLog.length === 0) return false;

        const habit = await db
            .select()
            .from(habits)
            .where(eq(habits.id, dayLog[0].habitId))
            .limit(1);

        return habit.length > 0 && habit[0].userId === user.id;
    },
    beforeCreate: async (c, data) => {
        // Optional: additional validation or defaults
        return data;
    },
    // Optional: override list if you want to restrict to user's habits only
    overrides: {
        create: async (c) => {
            console.log(c)

            const { habitId, date } = c.req.valid('json');

            return await db.transaction(async (tx) => {
                // Ensure DayLog Wrapper
                const existingDayLog = await tx.query.dayLogs.findFirst({
                    where: (l, { and, eq }) => and(eq(l.habitId, habitId), eq(l.date, date))
                });
                if (!existingDayLog) {
                    const hres = await tx.insert(dayLogs).values({ habitId, date }).returning();
                }
                const hres = existingDayLog

                const res = await tx.insert(exerciseSessions).values({ habitId, date }).returning();

                return c.json(res[0])
            });
        },
    }
});

export default sessionRouter;