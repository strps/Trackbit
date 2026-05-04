import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAdminAuth } from '../../middleware/require-admin-auth.js'
import db from '../../db/db.js'
import { issues } from '../../db/schema/index.js'
import { user } from '../../db/schema/app/user.js'
import { eq, and } from 'drizzle-orm'

type AuthEnv = {
    Variables: {
        user: any
        session: any
    }
}

const app = new Hono<AuthEnv>()
app.use('*', requireAdminAuth)

app.get('/', async (c) => {
    const statusParam = c.req.query('status') as 'open' | 'resolved' | 'closed' | undefined
    const typeParam = c.req.query('type') as 'bug' | 'feedback' | undefined

    const conditions = []
    if (statusParam) conditions.push(eq(issues.status, statusParam))
    if (typeParam) conditions.push(eq(issues.type, typeParam))

    const rows = await db
        .select({
            id: issues.id,
            type: issues.type,
            title: issues.title,
            path: issues.path,
            description: issues.description,
            stackTrace: issues.stackTrace,
            status: issues.status,
            createdAt: issues.createdAt,
            updatedAt: issues.updatedAt,
            userId: issues.userId,
            userName: user.name,
            userEmail: user.email,
        })
        .from(issues)
        .leftJoin(user, eq(issues.userId, user.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(issues.createdAt)

    return c.json(rows)
})

app.patch(
    '/:id',
    zValidator('json', z.object({
        status: z.enum(['open', 'resolved', 'closed']),
    })),
    async (c) => {
        const id = parseInt(c.req.param('id'))
        if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400)

        const { status } = c.req.valid('json')

        const [updated] = await db
            .update(issues)
            .set({ status, updatedAt: new Date() })
            .where(eq(issues.id, id))
            .returning()

        if (!updated) return c.json({ error: 'Issue not found' }, 404)
        return c.json(updated)
    }
)

export default app
