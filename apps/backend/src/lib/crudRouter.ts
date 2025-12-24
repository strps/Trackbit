// backend/src/routes/utils/generateCrudRouter.ts (configuration-based version)
import { Hono, type Context, type Handler } from 'hono';
import { zValidator } from '@hono/zod-validator';
import db from "../db/db";
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import type { AnyPgTable } from 'drizzle-orm/pg-core';

type CrudConfig<
    Entity,
    CreateInput = Entity,
    UpdateInput = Partial<Entity>,
    IdType = number | string
> = {
    /** Name of the primary key column in the table (defaults to 'id') */
    idColumn?: string;

    /** Zod validation schemas */
    schemas: {
        id: z.ZodType<IdType>;
        create: z.ZodType<CreateInput>;
        update: z.ZodType<UpdateInput>;
    };

    /** Drizzle table object (required for executing queries) */
    table: AnyPgTable;

    /** Optional ownership check for list/get/update/delete operations */
    ownershipCheck?: (user: any, record: Entity) => boolean | Promise<boolean>;

    /** Optional hook executed before inserting a new record */
    beforeCreate?: (c: Context, data: CreateInput) => Promise<CreateInput>;

    /** Optional hook executed before updating a record */
    beforeUpdate?: (c: Context, data: UpdateInput) => Promise<UpdateInput>;

    /** Override any standard CRUD endpoint with custom middleware/handler(s) */
    overrides?: {
        list?: Handler | Handler[];
        get?: Handler | Handler[];
        create?: Handler | Handler[];
        update?: Handler | Handler[];
        delete?: Handler | Handler[];
    };

    /** Additional custom routes beyond standard CRUD */
    customEndpoints?: Array<{
        method: 'get' | 'post' | 'put' | 'patch' | 'delete';
        path: string;
        handlers: Handler | Handler[];
    }>;

    /** If true, authentication middleware is skipped for all routes */
    isPublic?: boolean;
};

export function generateCrudRouter<
    Entity,
    CreateInput = Entity,
    UpdateInput = Partial<Entity>,
    IdType = number | string
>(config: CrudConfig<Entity, CreateInput, UpdateInput, IdType>) {
    const {
        idColumn = 'id',
        schemas,
        table,
        ownershipCheck,
        beforeCreate,
        beforeUpdate,
        overrides = {},
        customEndpoints = [],
        isPublic = false,
    } = config;

    const router = new Hono();

    // Apply authentication unless explicitly public
    if (!isPublic) {
        router.use('*', requireAuth);
    }

    // LIST - GET /
    if (overrides.list) {
        router.get('/', ...(Array.isArray(overrides.list) ? overrides.list : [overrides.list]) as [Handler, ...Handler[]]);
    } else {
        router.get('/', async (c: Context) => {
            const user = c.get('user');
            let query = db.select().from(table).$dynamic();

            if (ownershipCheck) {
                // Simple fallback: assume userId column exists if ownershipCheck is provided
                // You can extend this with a more sophisticated column detection if needed
                if ('userId' in table) {
                    query = query.where(eq((table as any).userId, user.id));
                }
                // Note: more complex ownership logic should be handled inside ownershipCheck during get/update/delete
            }

            const records = await query;
            return c.json(records);
        });
    }

    // GET ONE - GET /:id
    const getHandlers = overrides.get
        ? (Array.isArray(overrides.get) ? overrides.get : [overrides.get])
        : [async (c: Context<any, any, any>) => {
            const user = c.get('user');
            const { id } = c.req.valid('param') as { id: IdType };

            const [record] = await db
                .select()
                .from(table)
                .where(eq((table as any)[idColumn], id))
                .limit(1);

            if (!record || (ownershipCheck && !(await ownershipCheck(user, record as Entity)))) {
                return c.json({ error: 'Not found or unauthorized' }, 404);
            }

            return c.json(record);
        }];

    router.get(
        '/:id',
        zValidator('param', z.object({ id: schemas.id })),
        ...getHandlers
    );

    // CREATE - POST /
    if (overrides.create) {
        router.post('/', ...(Array.isArray(overrides.create) ? overrides.create : [overrides.create]) as [Handler, ...Handler[]]);
    } else {
        router.post(
            '/',
            zValidator('json', schemas.create),
            async (c: Context<any, any, any>) => {
                const user = c.get('user');
                let data = c.req.valid('json') as CreateInput;

                if (beforeCreate) {
                    data = await beforeCreate(c, data);
                }

                const [newRecord] = await db
                    .insert(table)
                    .values(data as any)
                    .returning();

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
            async (c: Context<any, any, any>) => {
                const user = c.get('user');
                const { id } = c.req.valid('param') as { id: IdType };
                let data = c.req.valid('json') as UpdateInput;

                if (beforeUpdate) {
                    data = await beforeUpdate(c, data);
                }

                const [existing] = await db
                    .select()
                    .from(table)
                    .where(eq((table as any)[idColumn], id))
                    .limit(1);

                if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing as Entity)))) {
                    return c.json({ error: 'Not found or unauthorized' }, 404);
                }

                const [updated] = await db
                    .update(table)
                    .set(data as any)
                    .where(eq((table as any)[idColumn], id))
                    .returning();

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
            async (c: Context<any, any, any>) => {
                const user = c.get('user');
                const { id } = c.req.valid('param') as { id: IdType };

                const [existing] = await db
                    .select()
                    .from(table)
                    .where(eq((table as any)[idColumn], id))
                    .limit(1);

                if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing as Entity)))) {
                    return c.json({ error: 'Not found or unauthorized' }, 404);
                }

                await db.delete(table).where(eq((table as any)[idColumn], id));

                return c.json({ success: true, id });
            }
        );
    }

    // Custom Endpoints
    customEndpoints.forEach(({ method, path, handlers }) => {
        const handlerArray = Array.isArray(handlers) ? handlers : [handlers];
        const safeHandlers = handlerArray as [Handler, ...Handler[]];
        switch (method) {
            case 'get':
                router.get(path, ...safeHandlers);
                break;
            case 'post':
                router.post(path, ...safeHandlers);
                break;
            case 'put':
                router.put(path, ...safeHandlers);
                break;
            case 'patch':
                router.patch(path, ...safeHandlers);
                break;
            case 'delete':
                router.delete(path, ...safeHandlers);
                break;
        }
    });

    return router;
}