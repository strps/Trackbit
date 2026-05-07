import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAdminAuth } from '../../middleware/require-admin-auth.js'
import db from '../../db/db.js'
import { appLimits } from '../../db/schema/app/settings.js'
import { habitTypeEnum } from '../../db/schema/app/habits.js'
import { ensureDefaultAppLimits } from '../../lib/app-limits.js'

type AuthEnv = {
    Variables: {
        user: any
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAdminAuth)

const habitTypeSchema = z.enum(habitTypeEnum.enumValues)

const createSchema = z.object({
    role: z.string().min(1).max(64),
    maxHabits: z.number().int().min(0).nullable().optional(),
    maxCustomExercises: z.number().int().min(0).nullable().optional(),
    allowedHabitTypes: z.array(habitTypeSchema).optional(),
})

const updateSchema = z.object({
    maxHabits: z.number().int().min(0).nullable().optional(),
    maxCustomExercises: z.number().int().min(0).nullable().optional(),
    allowedHabitTypes: z.array(habitTypeSchema).optional(),
})

// GET /admin/limits — list all role limits (seeds default tester row if empty)
app.get('/', async (c) => {
    const rows = await ensureDefaultAppLimits()
    return c.json(rows)
})

// POST /admin/limits — create a new role limits row
app.post('/', zValidator('json', createSchema), async (c) => {
    const body = c.req.valid('json')

    const [existing] = await db
        .select()
        .from(appLimits)
        .where(eq(appLimits.role, body.role))
        .limit(1)

    if (existing) {
        return c.json({ error: `Limits for role "${body.role}" already exist` }, 409)
    }

    const [created] = await db.insert(appLimits).values(body).returning()
    return c.json(created, 201)
})

// PUT /admin/limits/:role — update limits for a role
app.put('/:role', zValidator('json', updateSchema), async (c) => {
    const role = c.req.param('role')
    const body = c.req.valid('json')

    const [updated] = await db
        .update(appLimits)
        .set(body)
        .where(eq(appLimits.role, role))
        .returning()

    if (!updated) {
        return c.json({ error: `Limits for role "${role}" not found` }, 404)
    }

    return c.json(updated)
})

// DELETE /admin/limits/:role — remove limits for a role
app.delete('/:role', async (c) => {
    const role = c.req.param('role')

    const [deleted] = await db
        .delete(appLimits)
        .where(eq(appLimits.role, role))
        .returning()

    if (!deleted) {
        return c.json({ error: `Limits for role "${role}" not found` }, 404)
    }

    return c.json({ success: true })
})

export default app
