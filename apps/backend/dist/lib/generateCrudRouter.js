"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCrudRouter = generateCrudRouter;
// backend/src/routes/utils/generateCrudRouter.ts (resolved version with type assertions for Drizzle generics)
const hono_1 = require("hono");
const zod_validator_1 = require("@hono/zod-validator");
const db_1 = __importDefault(require("../db/db"));
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const zod_1 = __importDefault(require("zod"));
function hasUserIdColumn(table) {
    return 'userId' in table && 'id' in table;
}
function generateCrudRouter({ table, schemas, ownershipCheck, beforeCreate, beforeUpdate, overrides = {}, customEndpoints = [], isPublic = false, }) {
    const router = new hono_1.Hono();
    if (!isPublic) {
        router.use('*', auth_1.requireAuth);
    }
    // LIST - GET /
    if (overrides.list) {
        router.get('/', ...(Array.isArray(overrides.list) ? overrides.list : [overrides.list]));
    }
    else {
        router.get('/', async (c) => {
            const user = c.get('user');
            let whereClause;
            if (ownershipCheck && hasUserIdColumn(table)) {
                whereClause = (0, drizzle_orm_1.eq)(table.userId, user.id);
            }
            const records = await db_1.default.select().from(table).where(whereClause);
            return c.json(records);
        });
    }
    // GET ONE - GET /:id
    if (overrides.get) {
        router.get('/:id', (0, zod_validator_1.zValidator)('param', zod_1.default.object({ id: schemas.id })), ...(Array.isArray(overrides.get) ? overrides.get : [overrides.get]));
    }
    else {
        router.get('/:id', (0, zod_validator_1.zValidator)('param', zod_1.default.object({ id: schemas.id })), async (c) => {
            const user = c.get('user');
            const { id } = c.req.valid('param');
            const [found] = (await db_1.default
                .select()
                .from(table)
                .where((0, drizzle_orm_1.eq)(table.id, id))
                .limit(1));
            if (!found || (ownershipCheck && !(await ownershipCheck(user, found)))) {
                return c.json({ error: 'Not found or unauthorized' }, 404);
            }
            return c.json(found);
        });
    }
    // CREATE - POST /
    if (overrides.create) {
        router.post('/', ...(Array.isArray(overrides.create) ? overrides.create : [overrides.create]));
    }
    else {
        router.post('/', (0, zod_validator_1.zValidator)('json', schemas.create), async (c) => {
            const user = c.get('user');
            let data = c.req.valid('json');
            if (beforeCreate)
                data = await beforeCreate(c, data);
            const [newRecord] = await db_1.default.insert(table).values(data).returning();
            return c.json(newRecord, 201);
        });
    }
    // UPDATE - PATCH /:id
    if (overrides.update) {
        router.patch('/:id', ...(Array.isArray(overrides.update) ? overrides.update : [overrides.update]));
    }
    else {
        router.patch('/:id', (0, zod_validator_1.zValidator)('param', zod_1.default.object({ id: schemas.id })), (0, zod_validator_1.zValidator)('json', schemas.update), async (c) => {
            const user = c.get('user');
            const { id } = c.req.valid('param');
            let data = c.req.valid('json');
            if (beforeUpdate)
                data = await beforeUpdate(c, data);
            const [existing] = (await db_1.default
                .select()
                .from(table)
                .where((0, drizzle_orm_1.eq)(table.id, id))
                .limit(1));
            if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
                return c.json({ error: 'Not found or unauthorized' }, 404);
            }
            const [updated] = await db_1.default
                .update(table)
                .set(data)
                .where((0, drizzle_orm_1.eq)(table.id, id))
                .returning();
            return c.json(updated);
        });
    }
    // DELETE - DELETE /:id
    if (overrides.delete) {
        router.delete('/:id', ...(Array.isArray(overrides.delete) ? overrides.delete : [overrides.delete]));
    }
    else {
        router.delete('/:id', (0, zod_validator_1.zValidator)('param', zod_1.default.object({ id: schemas.id })), async (c) => {
            const user = c.get('user');
            const { id } = c.req.valid('param');
            const [existing] = (await db_1.default
                .select()
                .from(table)
                .where((0, drizzle_orm_1.eq)(table.id, id))
                .limit(1));
            if (!existing || (ownershipCheck && !(await ownershipCheck(user, existing)))) {
                return c.json({ error: 'Not found or unauthorized' }, 404);
            }
            await db_1.default.delete(table).where((0, drizzle_orm_1.eq)(table.id, id));
            return c.json({ success: true, id });
        });
    }
    // Custom Endpoints
    customEndpoints.forEach(({ method, path, handlers }) => {
        const handlerArray = (Array.isArray(handlers) ? handlers : [handlers]);
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