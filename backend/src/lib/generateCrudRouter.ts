// backend/src/routes/utils/generateCrudRouter.ts (updated with integrated authentication)
import { Hono, type Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import db from '../db/db';
import { eq } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import type { generateCrudSchemas } from './validationSchemas';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { AnyPgTable, PgSelectBuilder, PgTable } from 'drizzle-orm/pg-core';

type CrudRouterOptions<T extends AnyPgTable> = {
    table: T;
    schemas: ReturnType<typeof generateCrudSchemas<T>>;
    ownershipCheck?: (user: any, record: InferSelectModel<T>) => boolean | Promise<boolean>;
    beforeCreate?: (c: Context, data: InferInsertModel<T>) => Promise<InferInsertModel<T>>;
    beforeUpdate?: (c: Context, data: Partial<InferInsertModel<T>>) => Promise<Partial<InferInsertModel<T>>>;
    /** Override any standard CRUD endpoint with a custom handler */
    overrides?: {
        list?: Hono['get'] extends (path: '/', ...handlers: infer H) => any ? H[number] : never;
        get?: Hono['get'] extends (path: '/:id', ...handlers: infer H) => any ? H[number] : never;
        create?: Hono['post'] extends (path: '/', ...handlers: infer H) => any ? H[number] : never;
        update?: Hono['patch'] extends (path: '/:id', ...handlers: infer H) => any ? H[number] : never;
        delete?: Hono['delete'] extends (path: '/:id', ...handlers: infer H) => any ? H[number] : never;
    };
    /** Add completely custom endpoints (path + method + handlers) */
    customEndpoints?: Array<{
        method: 'get' | 'post' | 'put' | 'patch' | 'delete';
        path: string;
        handlers: any[];
    }>;
    /** Optional: Skip applying requireAuth middleware (e.g., for public routes) */
    isPublic?: boolean;
};


/**
 * Type guard to check if the provided table has a 'userId' column.
 * This enables safe narrowing of the generic table type T when applying
 * ownership-based filtering in the list endpoint.
 */
function hasUserIdColumn(table: any): table is { userId: typeof table['id'] } {
    return 'userId' in table;
}


/**
 * Generates a standard CRUD router with integrated authentication middleware.
 * 
 * By default, applies requireAuth to all routes. Set `public: true` to skip authentication.
 */
export function generateCrudRouter<T extends AnyPgTable>({
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
        if (ownershipCheck && hasUserIdColumn(table)) { // Check if column exists
            whereClause = eq(table.userId, user.id);
        }
        // Or allow custom where via options if needed
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
        router.post('/', overrides.create);
    } else {
        router.post('/', zValidator('json', schemas.create), createHandler);
    }

    // UPDATE - PATCH /:id
    const updateHandler = async (c: Context) => {
        const user = c.get('user');
        const { id } = c.req.valid('param');
        let data = c.req.valid('json');
        if (beforeUpdate) data = await beforeUpdate(c, data);

        // Fixed: Use table-based query instead of db.query[tableName]
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
        router.patch('/:id', ...overrides.update);
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
        router.delete('/:id', ...overrides.delete);
    } else {
        router.delete(
            '/:id',
            zValidator('param', z.object({ id: schemas.id })),
            deleteHandler
        );
    }

    // Custom Endpoints
    customEndpoints.forEach(({ method, path, handlers }) => {
        switch (method) {
            case 'get':
                router.get(path, ...handlers);
                break;
            case 'post':
                router.post(path, ...handlers);
                break;
            case 'put':
                router.put(path, ...handlers);
                break;
            case 'patch':
                router.patch(path, ...handlers);
                break;
            case 'delete':
                router.delete(path, ...handlers);
                break;
        }
    });

    return router;
}