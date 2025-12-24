import { z } from 'zod';
import type { Table } from 'drizzle-orm';
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
export declare function generateCrudSchemas<T extends Table, InsertShape extends ZodRawShape = ZodRawShape>(table: T, options?: {
    /** Common refinements applied to all schemas (e.g., date formats, min/max) */
    refine?: (schema: ZodObject<any>) => ZodObject<any>;
    /** Fields to omit from create/update (e.g., id, createdAt, userId managed server-side) */
    omitFromCreateUpdate?: (keyof T['$inferInsert'])[];
    /** Fields to omit from select/response (rarely needed) */
    omitFromSelect?: (keyof T['$inferSelect'])[];
    /** Custom override for the id param schema */
    idSchema?: z.ZodType<any>;
}): {
    create: z.ZodObject<any, z.core.$strip>;
    update: z.ZodObject<{
        [x: string]: z.ZodOptional<any>;
    }, z.core.$strip>;
    select: z.ZodObject<any, z.core.$strip>;
    id: z.ZodType<any, unknown, z.core.$ZodTypeInternals<any, unknown>>;
    _insertBase: import("drizzle-zod").BuildSchema<"insert", T["_"]["columns"], undefined, undefined>;
    _selectBase: import("drizzle-zod").BuildSchema<"select", T["_"]["columns"], undefined, undefined>;
};
//# sourceMappingURL=validationSchemas.d.ts.map