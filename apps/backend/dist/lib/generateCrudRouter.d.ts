import { Hono, type Context, type Handler } from 'hono';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { generateCrudSchemas } from './validationSchemas';
import { AnyPgTable } from 'drizzle-orm/pg-core';
type CrudRouterOptions<T extends AnyPgTable & {
    id: any;
}> = {
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
export declare function generateCrudRouter<T extends AnyPgTable & {
    id: any;
}>({ table, schemas, ownershipCheck, beforeCreate, beforeUpdate, overrides, customEndpoints, isPublic, }: CrudRouterOptions<T>): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=generateCrudRouter.d.ts.map