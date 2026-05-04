import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import db from '../../db/db.js'
import { issues } from '../../db/schema/index.js'
import { requireAuth } from '../../middleware/auth.js'

type AuthEnv = {
    Variables: {
        user: any
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAuth)

app.post(
    '/',
    zValidator('json', z.object({
        type: z.enum(['bug', 'feedback']).default('bug'),
        title: z.string().max(255).optional(),
        path: z.string().optional(),
        description: z.string().min(1),
        stackTrace: z.string().optional(),
    })),
    async (c) => {
        const user = c.get('user')
        const body = c.req.valid('json')

        const result = await db.insert(issues).values({
            ...body,
            userId: user.id,
        }).returning()

        return c.json(result[0], 201)
    }
)

export default app
