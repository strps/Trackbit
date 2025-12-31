// TODO: Define a standardized ApiError interface for consistent client-facing error responses
// Example: { error: string; details?: Record<string, any>; code?: string; }
// Update formatZodError to align with this format

// TODO: Add centralized error handling middleware with server-side logging
// Implement router.onError to catch unhandled exceptions, handle common cases (ZodError, unique constraints),
// and return standardized error responses (e.g., 400 for validation, 409 for conflicts, 500 for internals)
// Optionally accept a logger function via CrudRouterOptions

// TODO: Wrap database operations in try-catch for specific error handling (e.g., unique constraint violations → 409 Conflict)
// Also safely execute beforeCreate hook and handle any exceptions (return 400 if hook fails)

import { Hono, type Context, type Handler } from 'hono';
import { zValidator } from '@hono/zod-validator';
import db from "../../db/db.js";
import { eq, and } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';
import { AnyPgTable } from 'drizzle-orm/pg-core';
import z, { ZodError } from 'zod';
import { formatZodError } from '../utils.js';

type AppEnv = {
    Variables: {
        user: any;  // Replace 'any' with your actual User type if available
    }
};

// Define a precise, reusable type for the CRUD schemas
export type CrudSchemas = {
    create: z.ZodObject<any>;       // Schema for POST/create (insert without auto-managed fields)
    update: z.ZodObject<any>;       // Schema for PATCH/update (partial + at least one field required)
    select: z.ZodObject<any>;       // Schema for GET/response (full selectable shape)
    id: z.ZodType<any>;             // Schema for primary key path parameter(s) – defaults to number().int().positive()
    _insertBase: z.ZodObject<any>;  // Raw base insert schema (before omissions/refinements)
    _selectBase: z.ZodObject<any>;  // Raw base select schema (before omissions/refinements)
};

// Utility to build equality conditions for composite PK
function buildPkWhere<T extends AnyPgTable>(
    table: T,
    pkFields: (keyof InferSelectModel<T>)[],
    pkValues: any[]
) {
    if (pkFields.length === 1) {
        return eq((table as any)[pkFields[0]], pkValues[0]);
    }
    return and(...pkFields.map((field, i) => eq((table as any)[field], pkValues[i])))!;
}

type CrudRouterOptions<
    T extends AnyPgTable,
    PKFields extends (keyof InferSelectModel<T>)[] =
    'id' extends keyof InferSelectModel<T> ? ['id'] : never,
    PkParamOut = z.infer<z.ZodObject<Record<PKFields[number], z.ZodType<any>>>>
> = {
    table: T;
    schemas: CrudSchemas;
    primaryKeyFields: PKFields;
    ownershipCheck?: (user: any, record: InferSelectModel<T>) => boolean | Promise<boolean>;
    beforeCreate?: (c: Context, data: InferInsertModel<T>) => Promise<InferInsertModel<T>>;
    beforeUpdate?: (c: Context, data: Partial<InferInsertModel<T>>) => Promise<Partial<InferInsertModel<T>>>;
    overrides?: {
        list?: Handler;
        get?: Handler<any, any, { out: { param: PkParamOut } }>
        create?: Handler<any, any, { out: { json: InferInsertModel<T> } }>
        update?: Handler<any, any, { out: { param: PkParamOut; json: Partial<InferInsertModel<T>> } }>
        delete?: Handler<any, any, { out: { param: PkParamOut } }>
    };
    ommitOperations?: Array<'list' | 'get' | 'create' | 'update' | 'delete'>;
    customEndpoints?: Array<{
        method: 'get' | 'post' | 'put' | 'patch' | 'delete';
        path: string;
        handler: Handler;
    }>;
    isPublic?: boolean;
};

function hasUserIdColumn(table: any): table is { userId: any } {
    return 'userId' in table;
}

export function generateCrudRouter<
    T extends AnyPgTable,
    PKFields extends (keyof InferSelectModel<T>)[] =
    'id' extends keyof InferSelectModel<T> ? ['id'] : never
>({
    table,
    schemas,
    primaryKeyFields,
    ownershipCheck,
    beforeCreate,
    beforeUpdate,
    overrides = {} as CrudRouterOptions<T, PKFields>['overrides'],
    ommitOperations = [],
    customEndpoints = [],
    isPublic = false,
}: CrudRouterOptions<T, PKFields>) {

    const router = new Hono<AppEnv>();

    if (!isPublic) {
        router.use('*', requireAuth);
    }

    const shouldInclude = (op: 'list' | 'get' | 'create' | 'update' | 'delete') => !ommitOperations.includes(op);

    // Determine route segment and param schema for PK
    const pkParamNames = Array.isArray(primaryKeyFields) ? primaryKeyFields : [primaryKeyFields];
    const pkRouteSegment = `:${pkParamNames.join('/:')}`;
    const pkParamSchema = z.object(
        Object.fromEntries(
            pkParamNames.map(field => [field, schemas.id ?? z.any()])
        )
    );

    type PkParamOut = z.infer<typeof pkParamSchema>;

    // Helper to extract PK values in order
    const extractPkValues = (params: PkParamOut): any[] => pkParamNames.map(name => params[name as keyof PkParamOut]);

    // Param validator (shared where needed)
    const paramValidator = zValidator('param', pkParamSchema, (result, c) => {
        if (!result.success) {
            return c.json(formatZodError(result.error as ZodError), 400);
        }
    });

    // LIST - GET /
    if (shouldInclude('list')) {
        if (overrides?.list) {
            router.get('/', overrides.list);
        } else {
            router.get('/', async (c: Context) => {
                const user = c.get('user');
                let whereClause: any;
                if (ownershipCheck && hasUserIdColumn(table)) {
                    whereClause = eq((table as any).userId, user.id);
                }
                const records = await db.select().from(table as any).where(whereClause);
                return c.json(records);
            });
        }
    }

    // GET ONE - GET /:field1/:field2/...
    if (shouldInclude('get')) {
        const path = `/${pkRouteSegment}`;
        if (overrides?.get) {
            router.get(path, paramValidator, overrides.get);
        } else {
            router.get(
                path,
                paramValidator,
                async (c: Context<any, any, { out: { param: PkParamOut } }>) => {
                    const user = c.get('user');
                    const params = c.req.valid('param');
                    const pkValues = extractPkValues(params);

                    const [found] = await db
                        .select()
                        .from(table as any)
                        .where(buildPkWhere(table, pkParamNames, pkValues))
                        .limit(1) as InferSelectModel<T>[];

                    if (!found || (ownershipCheck && !(await ownershipCheck(user, found)))) {
                        return c.json({ error: 'Not found or unauthorized' }, 404);
                    }
                    return c.json(found);
                }
            );
        }
    }

    // CREATE - POST /
    if (shouldInclude('create')) {
        const jsonValidator = zValidator('json', schemas.create, (result, c) => {
            if (!result.success) {
                return c.json(formatZodError(result.error as ZodError), 400);
            }
        });

        if (overrides?.create) {
            router.post('/', jsonValidator, overrides.create);
        } else {
            router.post(
                '/',
                jsonValidator,
                async (c: Context<any, any, { out: { json: InferInsertModel<T> } }>) => {
                    const user = c.get('user');
                    let data = c.req.valid('json');
                    if (beforeCreate) data = await beforeCreate(c, data);
                    const [newRecord] = await db.insert(table as any).values(data).returning() as any[];
                    return c.json(newRecord, 201);
                }
            );
        }
    }

    // UPDATE - PATCH /:field1/:field2/...
    if (shouldInclude('update')) {
        const path = `/${pkRouteSegment}`;
        const updateJsonValidator = zValidator('json', schemas.update, (result, c) => {
            if (!result.success) {
                return c.json(formatZodError(result.error as ZodError), 400);
            }
        });

        if (overrides?.update) {
            router.patch(path, paramValidator, updateJsonValidator, overrides.update);
        } else {
            router.patch(
                path,
                paramValidator,
                updateJsonValidator,
                async (c: Context<any, any, { out: { param: PkParamOut; json: Partial<InferInsertModel<T>> } }>) => {
                    const user = c.get('user');
                    const params = c.req.valid('param');
                    const pkValues = extractPkValues(params);
                    let data = c.req.valid('json');
                    if (beforeUpdate) data = await beforeUpdate(c, data);

                    const [existing] = await db
                        .select()
                        .from(table as any)
                        .where(buildPkWhere(table, pkParamNames, pkValues))
                        .limit(1) as InferSelectModel<T>[];

                    if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
                        return c.json({ error: 'Not found or unauthorized' }, 404);
                    }

                    const [updated] = await db
                        .update(table as any)
                        .set(data)
                        .where(buildPkWhere(table, pkParamNames, pkValues))
                        .returning() as any[];

                    return c.json(updated);
                }
            );
        }
    }

    // DELETE - DELETE /:field1/:field2/...
    if (shouldInclude('delete')) {
        const path = `/${pkRouteSegment}`;
        if (overrides?.delete) {
            router.delete(path, paramValidator, overrides.delete);
        } else {
            router.delete(
                path,
                paramValidator,
                async (c: Context<any, any, { out: { param: PkParamOut } }>) => {
                    const user = c.get('user');
                    const params = c.req.valid('param');
                    const pkValues = extractPkValues(params);

                    const [existing] = await db
                        .select()
                        .from(table as any)
                        .where(buildPkWhere(table, pkParamNames, pkValues))
                        .limit(1) as InferSelectModel<T>[];

                    if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
                        return c.json({ error: 'Not found or unauthorized' }, 404);
                    }

                    await db.delete(table as any).where(buildPkWhere(table, pkParamNames, pkValues));
                    return c.json({ success: true, pk: params });
                }
            );
        }
    }

    // Custom Endpoints
    customEndpoints.forEach(({ method, path, handler }) => {
        switch (method) {
            case 'get': router.get(path, handler); break;
            case 'post': router.post(path, handler); break;
            case 'put': router.put(path, handler); break;
            case 'patch': router.patch(path, handler); break;
            case 'delete': router.delete(path, handler); break;
        }
    });

    return router;
}