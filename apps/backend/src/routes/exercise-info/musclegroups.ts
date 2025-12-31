import z from "zod";
import { muscleGroups } from "../../db/schema/index.js";
import { generateCrudRouter } from "../../lib/utilities/crud-router-factory.js";
import { defineCrudSchemas } from "../../lib/utilities/drizzle-crud-schemas.js";

const muscleGroupRouter = generateCrudRouter({
    table: muscleGroups,
    schemas: defineCrudSchemas(muscleGroups, {
        omitFromCreateUpdate: ['id'],
        refine: (schema) =>
            schema.refine(
                (data: any) => !!data.name?.trim(),
                { message: 'Muscle group name is required', path: ['name'] }
            ),
        idSchema: z.number().int().positive(),
    }),
    primaryKeyFields: ['id'],
});

export default muscleGroupRouter;