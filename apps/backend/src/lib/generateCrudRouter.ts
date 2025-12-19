// backend/src/routes/utils/generateCrudRouter.ts (fixed version)
import { Hono, type Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import db from "../db/db";
import { eq } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import type { generateCrudSchemas } from './validationSchemas';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { AnyPgTable, PgTable } from 'drizzle-orm/pg-core';


// Helper type to extract the id column type
type IdColumn<T extends AnyPgTable> = T extends { id: infer U } ? U : never;

type CrudRouterOptions<T extends AnyPgTable> = {
    table: T;
    schemas: ReturnType<typeof generateCrudSchemas<T>>;
    ownershipCheck?: (user: any, record: InferSelectModel<T>) => boolean | Promise<boolean>;
    beforeCreate?: (c: Context, data: InferInsertModel<T>) => Promise<InferInsertModel<T>>;
    beforeUpdate?: (c: Context, data: Partial<InferInsertModel<T>>) => Promise<Partial<InferInsertModel<T>>>;
    /** Override any standard CRUD endpoint with a custom handler (or array of middleware + handler) */
    overrides?: {
        list?: Parameters<Hono['get']>[1];
        get?: Parameters<Hono['get']>[1];
        create?: Parameters<Hono['post']>[1];
        update?: Parameters<Hono['patch']>[1];
        delete?: Parameters<Hono['delete']>[1];
    };
    /** Add completely custom endpoints (path + method + handlers) */
    customEndpoints?: Array<{
        method: 'get' | 'post' | 'put' | 'patch' | 'delete';
        path: string;
        handlers: Parameters<Hono['get']>[1];
    }>;
    /** Optional: Skip applying requireAuth middleware (e.g., for public routes) */
    isPublic?: boolean;
};

/**
 * Type guard to check if the provided table has a 'userId' column.
 */
function hasUserIdColumn(table: any): table is { userId: any; id: any } {
    return 'userId' in table && 'id' in table;
}

/**
 * Generates a standard CRUD router with integrated authentication middleware.
 */
export function generateCrudRouter<T extends AnyPgTable & { id: any }>({
    table,
    schemas,
    ownershipCheck,
    beforeCreate,
    beforeUpdate,
    overrides = {},
    customEndpoints = [],
    isPublic = false,
}: CrudRouterOptions<T>) {

    const router = new Hono();

    // Apply authentication middleware unless explicitly public
    if (!isPublic) {
        router.use('*', requireAuth);
    }

    // LIST - GET /
    const listHandler = async (c: Context) => {
        const user = c.get('user');
        let whereClause;
        if (ownershipCheck && hasUserIdColumn(table)) {
            whereClause = eq(table.userId, user.id);
        }
        const records = await db.select().from(table as PgTable).where(whereClause);
        return c.json(records);
    };
    router.get('/', overrides.list ?? listHandler);

    // GET ONE - GET /:id
    const getHandler = async (c: Context) => {
        const user = c.get('user');
        const { id } = c.req.valid('param');
        const record = await db
            .select()
            .from(table as PgTable)
            .where(eq(table.id, id))
            .limit(1);
        const found = record[0];
        if (!found || (ownershipCheck && !(await ownershipCheck(user, found)))) {
            return c.json({ error: 'Not found or unauthorized' }, 404);
        }
        return c.json(found);
    };
    router.get(
        '/:id',
        zValidator('param', z.object({ id: schemas.id })),
        overrides.get ?? getHandler
    );

    // CREATE - POST /
    const createHandler = async (c: Context) => {
        const user = c.get('user');
        let data = c.req.valid('json');
        if (beforeCreate) data = await beforeCreate(c, data);
        const [newRecord] = await db.insert(table).values(data).returning();
        return c.json(newRecord, 201);
    };
    if (overrides.create) {
        router.post('/', ...(Array.isArray(overrides.create) ? overrides.create : [overrides.create]));
    } else {
        router.post('/', zValidator('json', schemas.create), createHandler);
    }

    // UPDATE - PATCH /:id
    const updateHandler = async (c: Context) => {
        const user = c.get('user');
        const { id } = c.req.valid('param');
        let data = c.req.valid('json');
        if (beforeUpdate) data = await beforeUpdate(c, data);

        const record = await db
            .select()
            .from(table as PgTable)
            .where(eq(table.id, id))
            .limit(1);

        const existing = record[0];

        if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
            return c.json({ error: 'Not found or unauthorized' }, 404);
        }

        const [updated] = await db.update(table)
            .set(data)
            .where(eq(table.id, id))
            .returning();
        return c.json(updated);
    };

    if (overrides.update) {
        router.patch('/:id', ...(Array.isArray(overrides.update) ? overrides.update : [overrides.update]));
    } else {
        router.patch(
            '/:id',
            zValidator('param', z.object({ id: schemas.id })),
            zValidator('json', schemas.update),
            updateHandler
        );
    }

    // DELETE - DELETE /:id
    const deleteHandler = async (c: Context) => {
        const user = c.get('user');
        const { id } = c.req.valid('param');

        const record = await db
            .select()
            .from(table as PgTable)
            .where(eq(table.id, id))
            .limit(1);

        const existing = record[0];

        if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
            return c.json({ error: 'Not found or unauthorized' }, 404);
        }

        await db.delete(table).where(eq(table.id, id));
        return c.json({ success: true, id });
    };

    if (overrides.delete) {
        router.delete('/:id', ...(Array.isArray(overrides.delete) ? overrides.delete : [overrides.delete]));
    } else {
        router.delete(
            '/:id',
            zValidator('param', z.object({ id: schemas.id })),
            deleteHandler
        );
    }

    // Custom Endpoints
    customEndpoints.forEach(({ method, path, handlers }) => {
        const handlerArray = Array.isArray(handlers) ? handlers : [handlers];
        switch (method) {
            case 'get':
                router.get(path, ...handlerArray);
                break;
            case 'post':
                router.post(path, ...handlerArray);
                break;
            case 'put':
                router.put(path, ...handlerArray);
                break;
            case 'patch':
                router.patch(path, ...handlerArray);
                break;
            case 'delete':
                router.delete(path, ...handlerArray);
                break;
        }
    });

    return router;
}