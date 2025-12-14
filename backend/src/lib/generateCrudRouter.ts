// backend/src/routes/utils/generateCrudRouter.ts (updated with integrated authentication)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import db from '../db/db';
import { eq } from 'drizzle-orm';
import type { AnyTable } from 'drizzle-orm';
import type { generateCrudSchemas } from './validationSchemas';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

type CrudRouterOptions<T extends AnyTable<any>> = {
    table: T;
    schemas: ReturnType<typeof generateCrudSchemas<T>>;
    ownershipCheck?: (user: any, record: any) => boolean | Promise<boolean>;
    beforeCreate?: (c: any, data: any) => Promise<any>;
    beforeUpdate?: (c: any, data: any) => Promise<any>;
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
 * Generates a standard CRUD router with integrated authentication middleware.
 * 
 * By default, applies requireAuth to all routes. Set `public: true` to skip authentication.
 */
export function generateCrudRouter<T extends AnyTable<any>>({
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
    const listHandler = async (c: any) => {
        const user = c.get('user');
        let whereClause;
        if (ownershipCheck && table.userId) { // Check if column exists
            whereClause = eq(table.userId, user.id);
        }
        // Or allow custom where via options if needed
        const records = await db.select().from(table).where(whereClause);
        return c.json(records);
    };
    router.get('/', overrides.list ?? listHandler);

    // GET ONE - GET /:id
    const getHandler = async (c: any) => {
        const user = c.get('user');
        const { id } = c.req.valid('param');
        const record = await db
            .select()
            .from(table)
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
    const createHandler = async (c: any) => {
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
    const updateHandler = async (c: any) => {
        const user = c.get('user');
        const { id } = c.req.valid('param');
        let data = c.req.valid('json');
        if (beforeUpdate) data = await beforeUpdate(c, data);

        const existing = await db.query[tableName].findFirst({
            where: (tbl: any, { eq }) => eq(tbl.id, id),
        });
        if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
            return c.json({ error: 'Not found or unauthorized' }, 404);
        }

        const [updated] = await db.update(table)
            .set(data)
            .where(eq((table as any).id, id))
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
    const deleteHandler = async (c: any) => {
        const user = c.get('user');
        const { id } = c.req.valid('param');

        const existing = await db.query[tableName].findFirst({
            where: (tbl: any, { eq }) => eq(tbl.id, id),
        });
        if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
            return c.json({ error: 'Not found or unauthorized' }, 404);
        }

        await db.delete(table).where(eq((table as any).id, id));
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