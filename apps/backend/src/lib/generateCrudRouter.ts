// backend/src/routes/utils/generateCrudRouter.ts (resolved version with type assertions for Drizzle generics)
import { Hono, type Context, type Handler } from 'hono';
import { zValidator } from '@hono/zod-validator';
import db from "../db/db";
import { eq } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { generateCrudSchemas } from './validationSchemas';
import { requireAuth } from '../middleware/auth';
import { AnyPgTable } from 'drizzle-orm/pg-core';
import z from 'zod';

type IdType<T extends AnyPgTable & { id: any }> = T['id']['_']['type'];

type CrudRouterOptions<T extends AnyPgTable & { id: any }> = {
    table: T;
    schemas: ReturnType<typeof generateCrudSchemas<T>>;
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
    customEndpoints?: Array<{
        method: 'get' | 'post' | 'put' | 'patch' | 'delete';
        path: string;
        handlers: Handler | Handler[];
    }>;
    isPublic?: boolean;
};

function hasUserIdColumn(table: any): table is { userId: any; id: any } {
    return 'userId' in table && 'id' in table;
}

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

    if (!isPublic) {
        router.use('*', requireAuth);
    }

    // LIST - GET /
    if (overrides.list) {
        router.get('/', ...(Array.isArray(overrides.list) ? overrides.list : [overrides.list]) as [Handler, ...Handler[]]);
    } else {
        router.get('/', async (c: Context) => {
            const user = c.get('user');
            let whereClause: any;
            if (ownershipCheck && hasUserIdColumn(table)) {
                whereClause = eq(table.userId, user.id);
            }
            const records = await db.select().from(table as any).where(whereClause);
            return c.json(records);
        });
    }

    // GET ONE - GET /:id
    if (overrides.get) {
        router.get('/:id', zValidator('param', z.object({ id: schemas.id })), ...(Array.isArray(overrides.get) ? overrides.get : [overrides.get]));
    } else {
        router.get(
            '/:id',
            zValidator('param', z.object({ id: schemas.id })),
            async (c: Context<any, any, { out: { param: { id: IdType<T> } } }>) => {
                const user = c.get('user');
                const { id } = c.req.valid('param');
                const [found] = (await db
                    .select()
                    .from(table as any)
                    .where(eq(table.id, id))
                    .limit(1)) as InferSelectModel<T>[];

                if (!found || (ownershipCheck && !(await ownershipCheck(user, found)))) {
                    return c.json({ error: 'Not found or unauthorized' }, 404);
                }
                return c.json(found);
            }
        );
    }

    // CREATE - POST /
    if (overrides.create) {
        router.post('/', ...(Array.isArray(overrides.create) ? overrides.create : [overrides.create]) as [Handler, ...Handler[]]);
    } else {
        router.post(
            '/',
            zValidator('json', schemas.create),
            async (c: Context<any, any, { out: { json: InferInsertModel<T> } }>) => {
                const user = c.get('user');
                let data = c.req.valid('json');
                if (beforeCreate) data = await beforeCreate(c, data);
                const [newRecord] = await db.insert(table as any).values(data).returning() as any[];
                return c.json(newRecord, 201);
            }
        );
    }

    // UPDATE - PATCH /:id
    if (overrides.update) {
        router.patch('/:id', ...(Array.isArray(overrides.update) ? overrides.update : [overrides.update]) as [Handler, ...Handler[]]);
    } else {
        router.patch(
            '/:id',
            zValidator('param', z.object({ id: schemas.id })),
            zValidator('json', schemas.update),
            async (c: Context<any, any, { out: { param: { id: IdType<T> }; json: Partial<InferInsertModel<T>> } }>) => {
                const user = c.get('user');
                const { id } = c.req.valid('param');
                let data = c.req.valid('json');
                if (beforeUpdate) data = await beforeUpdate(c, data);

                const [existing] = (await db
                    .select()
                    .from(table as any)
                    .where(eq(table.id, id))
                    .limit(1)) as InferSelectModel<T>[];

                if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
                    return c.json({ error: 'Not found or unauthorized' }, 404);
                }

                const [updated] = await db
                    .update(table as any)
                    .set(data)
                    .where(eq(table.id, id))
                    .returning() as any[];
                return c.json(updated);
            }
        );
    }

    // DELETE - DELETE /:id
    if (overrides.delete) {
        router.delete('/:id', ...(Array.isArray(overrides.delete) ? overrides.delete : [overrides.delete]) as [Handler, ...Handler[]]);
    } else {
        router.delete(
            '/:id',
            zValidator('param', z.object({ id: schemas.id })),
            async (c: Context<any, any, { out: { param: { id: IdType<T> } } }>) => {
                const user = c.get('user');
                const { id } = c.req.valid('param');

                const [existing] = (await db
                    .select()
                    .from(table as any)
                    .where(eq(table.id, id))
                    .limit(1)) as InferSelectModel<T>[];

                if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
                    return c.json({ error: 'Not found or unauthorized' }, 404);
                }

                await db.delete(table as any).where(eq(table.id, id));
                return c.json({ success: true, id });
            }
        );
    }

    // Custom Endpoints
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