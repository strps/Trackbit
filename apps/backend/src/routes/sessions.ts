// backend/src/routes/exercise-sessions.ts

import { generateCrudRouter } from '../lib/generateCrudRouter.js';
import { generateCrudSchemas } from '../lib/validationSchemas.js';
import { dayLogs, exerciseSessions, habits } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import db from "../db/db.js";


const sessionSchemas = generateCrudSchemas(exerciseSessions, {
    omitFromCreateUpdate: ['id', 'createdAt'],

});
const sessionRouter = generateCrudRouter({
    table: exerciseSessions,
    schemas: sessionSchemas,

    // Enforce ownership: session belongs to a dayLog of a habit owned by the user
    ownershipCheck: async (user, record) => {
        const habit = await db
            .select()
            .from(habits)
            .where(eq(habits.id, record.habitId))
            .limit(1);

        return habit.length > 0 && habit[0].userId === user.id;
    },
    beforeCreate: async (c, data) => {
        console.log("Before create session:", data);
        //Check day log exists { habitId: 4, date: '2025-10-25' }
        const dayLog = await db
            .select()
            .from(dayLogs)
            .where(and(
                eq(dayLogs.habitId, data.habitId),
                eq(dayLogs.date, data.date)
            ))
            .limit(1);

        if (dayLog.length === 0) {
            console.log("Day log does not exist for, creating new one");
            await db
                .insert(dayLogs)
                .values({
                    habitId: data.habitId,
                    date: data.date
                })
        }

        return data;
    },

});

export default sessionRouter;