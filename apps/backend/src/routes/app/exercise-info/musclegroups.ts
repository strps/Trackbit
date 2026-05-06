import z from "zod";
import { muscleGroups } from "../../../db/schema/index.js";
import { generateCrudRouter } from "../../../lib/utilities/crud-router-factory.js";
import { defineCrudSchemas } from "../../../lib/utilities/drizzle-crud-schemas.js";
import { Context } from "hono";
import db from "../../../db/db.js";
import { sql } from "drizzle-orm";

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
    overrides: {
        list: async (c: Context) => {
            const locale = (c.get('locale') as string | undefined) ?? 'en'

            const rows = await db.select({
                id: muscleGroups.id,
                name: sql<string>`COALESCE(${muscleGroups.nameI18n}->>${locale}, ${muscleGroups.nameI18n}->>'en', ${muscleGroups.name})`.as('name'),
                slug: muscleGroups.slug,
                parentId: muscleGroups.parentId,
                level: muscleGroups.level,
                displayOrder: muscleGroups.displayOrder,
                createdAt: muscleGroups.createdAt,
            }).from(muscleGroups)

            return c.json(rows)
        },
    },
});

export default muscleGroupRouter;
