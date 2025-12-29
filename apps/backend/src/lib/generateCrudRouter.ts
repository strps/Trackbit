// backend/src/routes/utils/generateCrudRouter.ts

import { Hono, type Context, type Handler } from 'hono';
import { zValidator } from '@hono/zod-validator';
import db from "../db/db.js";
import { eq, and } from 'drizzle-orm'; // ← added 'and'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { generateValidationCrudSchemas } from './generateValidationCrudSchemas.js';
import { requireAuth } from '../middleware/auth.js';
import { AnyPgTable } from 'drizzle-orm/pg-core';
import z from 'zod';
import { formatZodError } from './utils.js';

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
    'id' extends keyof InferSelectModel<T> ? ['id'] : never
> = {
    table: T;
    schemas: ReturnType<typeof generateValidationCrudSchemas<T>>;
    // Always require explicit primaryKeyFields, but default to ['id'] when possible
    primaryKeyFields: PKFields;
    ownershipCheck?: (user: any, record: InferSelectModel<T>) => boolean | Promise<boolean>;
    beforeCreate?: (c: Context, data: InferInsertModel<T>) => Promise<InferInsertModel<T>>;
    beforeUpdate?: (c: Context, data: Partial<InferInsertModel<T>>) => Promise<Partial<InferInsertModel<T>>>;
    overrides?: {
        list?: Handler | Handler[];
        get?: Handler | Handler[];
        create?: Handler | Handler[];
        update?: Handler | Handler[];
        delete?: Handler | Handler[];
    };
    ommitOperations?: Array<'list' | 'get' | 'create' | 'update' | 'delete'>;
    customEndpoints?: Array<{
        method: 'get' | 'post' | 'put' | 'patch' | 'delete';
        path: string;
        handlers: Handler | Handler[];
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
    overrides = {},
    ommitOperations = [],
    customEndpoints = [],
    isPublic = false,
}: CrudRouterOptions<T, PKFields>) {
    const router = new Hono();

    if (!isPublic) {
        router.use('*', requireAuth);
    }

    const shouldInclude = (op: 'list' | 'get' | 'create' | 'update' | 'delete') => !ommitOperations.includes(op);

    // Determine route segment and param schema for PK
    const pkParamNames = Array.isArray(primaryKeyFields) ? primaryKeyFields : [primaryKeyFields];
    const pkRouteSegment = `:${pkParamNames.join('/:')}`;
    console.log("Primary Key Route Segment:", pkRouteSegment);
    const pkParamSchema = z.object(
        Object.fromEntries(
            pkParamNames.map(field => [field, (schemas as any)[field] ?? z.any()])
        )
    );

    type PkParamOut = z.infer<typeof pkParamSchema>;

    // Helper to extract PK values in order
    const extractPkValues = (params: PkParamOut): any[] => pkParamNames.map(name => params[name as keyof PkParamOut]);

    // LIST - GET /
    if (shouldInclude('list')) {
        if (overrides.list) {
            router.get('/', ...(Array.isArray(overrides.list) ? overrides.list : [overrides.list]) as [Handler, ...Handler[]]);
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
        if (overrides.get) {
            router.get(path, zValidator('param', pkParamSchema), ...(Array.isArray(overrides.get) ? overrides.get : [overrides.get]));
        } else {
            router.get(
                path,
                zValidator('param', pkParamSchema),
                async (c: Context<any, any, { out: { param: PkParamOut } }>) => {
                    const user = c.get('user');
                    const params = c.req.valid('param');
                    const pkValues = extractPkValues(params);

                    const [found] = (await db
                        .select()
                        .from(table as any)
                        .where(buildPkWhere(table, pkParamNames, pkValues))
                        .limit(1)) as InferSelectModel<T>[];

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
        if (overrides.create) {
            router.post(
                '/',
                zValidator('json', schemas.create, (result, c) => {
                    if (!result.success) {
                        return c.json(formatZodError(result.error), 400);
                    }
                }),
                ...(Array.isArray(overrides.create) ? overrides.create : [overrides.create]) as [Handler, ...Handler[]]);
        } else {
            router.post(
                '/',
                zValidator('json', schemas.create, (result, c) => {
                    if (!result.success) {
                        return c.json(formatZodError(result.error), 400);
                    }
                }),
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
        if (overrides.update) {
            router.patch(path, ...(Array.isArray(overrides.update) ? overrides.update : [overrides.update]) as [Handler, ...Handler[]]);
        } else {
            router.patch(
                path,
                zValidator('param', pkParamSchema, (result, c) => {
                    if (!result.success) {
                        return c.json(formatZodError(result.error), 400);
                    }
                }),
                zValidator('json', schemas.update, (result, c) => {
                    if (!result.success) {
                        return c.json(formatZodError(result.error), 400);
                    }
                }),
                async (c: Context<any, any, { out: { param: PkParamOut; json: Partial<InferInsertModel<T>> } }>) => {
                    const user = c.get('user');
                    const params = c.req.valid('param');
                    const pkValues = extractPkValues(params);
                    let data = c.req.valid('json');
                    if (beforeUpdate) data = await beforeUpdate(c, data);

                    const [existing] = (await db
                        .select()
                        .from(table as any)
                        .where(buildPkWhere(table, pkParamNames, pkValues))
                        .limit(1)) as InferSelectModel<T>[];

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
        if (overrides.delete) {
            router.delete(path, ...(Array.isArray(overrides.delete) ? overrides.delete : [overrides.delete]) as [Handler, ...Handler[]]);
        } else {
            router.delete(
                path,
                zValidator('param', pkParamSchema),
                async (c: Context<any, any, { out: { param: PkParamOut } }>) => {
                    const user = c.get('user');
                    const params = c.req.valid('param');
                    const pkValues = extractPkValues(params);

                    const [existing] = (await db
                        .select()
                        .from(table as any)
                        .where(buildPkWhere(table, pkParamNames, pkValues))
                        .limit(1)) as InferSelectModel<T>[];

                    if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
                        return c.json({ error: 'Not found or unauthorized' }, 404);
                    }

                    await db.delete(table as any).where(buildPkWhere(table, pkParamNames, pkValues));
                    return c.json({ success: true, pk: params });
                }
            );
        }
    }

    // Custom Endpoints (unchanged)
    customEndpoints.forEach(({ method, path, handlers }) => {
        const handlerArray = (Array.isArray(handlers) ? handlers : [handlers]) as [Handler, ...Handler[]];
        switch (method) {
            case 'get': router.get(path, ...handlerArray); break;
            case 'post': router.post(path, ...handlerArray); break;
            case 'put': router.put(path, ...handlerArray); break;
            case 'patch': router.patch(path, ...handlerArray); break;
            case 'delete': router.delete(path, ...handlerArray); break;
        }
    });

    return router;
}