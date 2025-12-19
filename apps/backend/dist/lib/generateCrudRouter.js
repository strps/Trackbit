"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCrudRouter = generateCrudRouter;
// backend/src/routes/utils/generateCrudRouter.ts (fixed version)
const hono_1 = require("hono");
const zod_validator_1 = require("@hono/zod-validator");
const db_1 = __importDefault(require("../db/db"));
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
/**
 * Type guard to check if the provided table has a 'userId' column.
 */
function hasUserIdColumn(table) {
    return 'userId' in table && 'id' in table;
}
/**
 * Type guard to check if the provided table has an 'id' column (required for standard CRUD operations).
 */
function hasIdColumn(table) {
    return 'id' in table;
}
/**
 * Generates a standard CRUD router with integrated authentication middleware.
 */
function generateCrudRouter({ table, schemas, ownershipCheck, beforeCreate, beforeUpdate, overrides = {}, customEndpoints = [], isPublic = false, }) {
    if (!hasIdColumn(table)) {
        throw new Error('Table must have an "id" column for CRUD operations');
    }
    const router = new hono_1.Hono();
    // Apply authentication middleware unless explicitly public
    if (!isPublic) {
        router.use('*', auth_1.requireAuth);
    }
    // LIST - GET /
    const listHandler = async (c) => {
        const user = c.get('user');
        let whereClause;
        if (ownershipCheck && hasUserIdColumn(table)) {
            whereClause = (0, drizzle_orm_1.eq)(table.userId, user.id);
        }
        const records = await db_1.default.select().from(table).where(whereClause);
        return c.json(records);
    };
    router.get('/', overrides.list ?? listHandler);
    // GET ONE - GET /:id
    const getHandler = async (c) => {
        const user = c.get('user');
        const { id } = c.req.valid('param');
        const record = await db_1.default
            .select()
            .from(table)
            .where((0, drizzle_orm_1.eq)(table.id, id))
            .limit(1);
        const found = record[0];
        if (!found || (ownershipCheck && !(await ownershipCheck(user, found)))) {
            return c.json({ error: 'Not found or unauthorized' }, 404);
        }
        return c.json(found);
    };
    router.get('/:id', (0, zod_validator_1.zValidator)('param', zod_1.z.object({ id: schemas.id })), overrides.get ?? getHandler);
    // CREATE - POST /
    const createHandler = async (c) => {
        const user = c.get('user');
        let data = c.req.valid('json');
        if (beforeCreate)
            data = await beforeCreate(c, data);
        const [newRecord] = await db_1.default.insert(table).values(data).returning();
        return c.json(newRecord, 201);
    };
    if (overrides.create) {
        router.post('/', ...(Array.isArray(overrides.create) ? overrides.create : [overrides.create]));
    }
    else {
        router.post('/', (0, zod_validator_1.zValidator)('json', schemas.create), createHandler);
    }
    // UPDATE - PATCH /:id
    const updateHandler = async (c) => {
        const user = c.get('user');
        const { id } = c.req.valid('param');
        let data = c.req.valid('json');
        if (beforeUpdate)
            data = await beforeUpdate(c, data);
        const record = await db_1.default
            .select()
            .from(table)
            .where((0, drizzle_orm_1.eq)(table.id, id))
            .limit(1);
        const existing = record[0];
        if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
            return c.json({ error: 'Not found or unauthorized' }, 404);
        }
        const [updated] = await db_1.default.update(table)
            .set(data)
            .where((0, drizzle_orm_1.eq)(table.id, id))
            .returning();
        return c.json(updated);
    };
    if (overrides.update) {
        router.patch('/:id', ...(Array.isArray(overrides.update) ? overrides.update : [overrides.update]));
    }
    else {
        router.patch('/:id', (0, zod_validator_1.zValidator)('param', zod_1.z.object({ id: schemas.id })), (0, zod_validator_1.zValidator)('json', schemas.update), updateHandler);
    }
    // DELETE - DELETE /:id
    const deleteHandler = async (c) => {
        const user = c.get('user');
        const { id } = c.req.valid('param');
        const record = await db_1.default
            .select()
            .from(table)
            .where((0, drizzle_orm_1.eq)(table.id, id))
            .limit(1);
        const existing = record[0];
        if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
            return c.json({ error: 'Not found or unauthorized' }, 404);
        }
        await db_1.default.delete(table).where((0, drizzle_orm_1.eq)(table.id, id));
        return c.json({ success: true, id });
    };
    if (overrides.delete) {
        router.delete('/:id', ...(Array.isArray(overrides.delete) ? overrides.delete : [overrides.delete]));
    }
    else {
        router.delete('/:id', (0, zod_validator_1.zValidator)('param', zod_1.z.object({ id: schemas.id })), deleteHandler);
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
//# sourceMappingURL=generateCrudRouter.js.map