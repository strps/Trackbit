// backend/src/db/validationSchemas.ts
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import type { AnyTable, Any } from 'drizzle-orm';
import type { ZodObject, ZodRawShape } from 'zod';

/**
 * Generates Zod schemas tailored for typical REST API CRUD operations.
 * 
 * This utility takes a Drizzle table definition and produces a set of schemas:
 * - create: For POST/create endpoints (insert schema, omitting auto-generated fields like id/createdAt)
 * - update: For PATCH/update endpoints (partial insert schema, requiring at least one field)
 * - select: For GET/response schemas (full select schema, including relations if needed)
 * - id: Simple schema for path param validation (e.g., /:id)
 * 
 * @param table - The Drizzle table definition
 * @param options - Optional refinements and overrides
 * @returns An object containing named Zod schemas for CRUD operations
 */
export function generateCrudSchemas<
    T extends AnyTable<any>,
    InsertShape extends ZodRawShape = ZodRawShape,
>(
    table: T,
    options: {
        /** Common refinements applied to all schemas (e.g., date formats, min/max) */
        refine?: (schema: ZodObject<any>) => ZodObject<any>;
        /** Fields to omit from create/update (e.g., id, createdAt, userId managed server-side) */
        omitFromCreateUpdate?: (keyof T['$inferInsert'])[];
        /** Fields to omit from select/response (rarely needed) */
        omitFromSelect?: (keyof T['$inferSelect'])[];
        /** Custom override for the id param schema */
        idSchema?: z.ZodType<any>;
    } = {}
) {
    const insertBase = createInsertSchema(table);
    const selectBase = createSelectSchema(table);

    // Apply common refinements if provided
    const refinedInsert = options.refine ? options.refine(insertBase) : insertBase;
    const refinedSelect = options.refine ? options.refine(selectBase) : selectBase;

    // Omit server-managed fields from create/update payloads
    const createSchema = options.omitFromCreateUpdate
        ? refinedInsert.omit(Object.fromEntries(
            options.omitFromCreateUpdate.map(field => [field, true])
        ) as any)
        : refinedInsert;

    const updateSchema = createSchema.partial().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided for update' }
    );

    const selectSchema = options.omitFromSelect
        ? refinedSelect.omit(Object.fromEntries(
            options.omitFromSelect.map(field => [field, true])
        ) as any)
        : refinedSelect;

    const idSchema = options.idSchema ?? z.number().int().positive();

    return {
        create: createSchema,
        update: updateSchema,
        select: selectSchema,
        id: idSchema,
        // Raw bases for advanced use
        _insertBase: insertBase,
        _selectBase: selectBase,
    };
}