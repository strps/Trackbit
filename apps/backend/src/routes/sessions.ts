// backend/src/routes/exercise-sessions.ts

import { generateCrudRouter } from '../lib/generateCrudRouter';
import { generateCrudSchemas } from '../lib/validationSchemas';
import { exerciseSessions, habits } from '../db/schema';
import { eq } from 'drizzle-orm';
import db from "../db/db";


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
        // Optional: additional validation or defaults
        return data;
    },

});

export default sessionRouter;