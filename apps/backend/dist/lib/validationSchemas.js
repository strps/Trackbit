"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCrudSchemas = generateCrudSchemas;
// backend/src/db/validationSchemas.ts
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
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
function generateCrudSchemas(table, options = {}) {
    const insertBase = (0, drizzle_zod_1.createInsertSchema)(table);
    const selectBase = (0, drizzle_zod_1.createSelectSchema)(table);
    // Apply common refinements if provided
    const refinedInsert = options.refine ? options.refine(insertBase) : insertBase;
    const refinedSelect = options.refine ? options.refine(selectBase) : selectBase;
    // Omit server-managed fields from create/update payloads
    const createSchema = options.omitFromCreateUpdate
        ? refinedInsert.omit(Object.fromEntries(options.omitFromCreateUpdate.map(field => [field, true])))
        : refinedInsert;
    const updateSchema = createSchema.partial().refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
    const selectSchema = options.omitFromSelect
        ? refinedSelect.omit(Object.fromEntries(options.omitFromSelect.map(field => [field, true])))
        : refinedSelect;
    const idSchema = options.idSchema ?? zod_1.z.coerce.number().int().positive();
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
//# sourceMappingURL=validationSchemas.js.map