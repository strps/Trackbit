import z from "zod";
import { muscleGroups } from "../../db/schema/index.js";
import { generateCrudRouter } from "../../lib/generateCrudRouter.js";
import { generateValidationCrudSchemas } from "../../lib/generateValidationCrudSchemas.js";

const muscleGroupRouter = generateCrudRouter({
    table: muscleGroups,
    schemas: generateValidationCrudSchemas(muscleGroups, {
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