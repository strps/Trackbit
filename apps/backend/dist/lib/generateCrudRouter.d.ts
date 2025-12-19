import { Hono, type Context } from 'hono';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { generateCrudSchemas } from './validationSchemas';
import { AnyPgTable } from 'drizzle-orm/pg-core';
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
 * Generates a standard CRUD router with integrated authentication middleware.
 */
export declare function generateCrudRouter<T extends AnyPgTable>({ table, schemas, ownershipCheck, beforeCreate, beforeUpdate, overrides, customEndpoints, isPublic, }: CrudRouterOptions<T>): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=generateCrudRouter.d.ts.map