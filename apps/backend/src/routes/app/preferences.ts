import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import db from '../../db/db.js'
import { user } from '../../db/schema/app/user.js'
import { requireAuth } from '../../middleware/auth.js'

const SUPPORTED_LOCALES = ['en', 'es'] as const
const SUPPORTED_UNIT_SYSTEMS = ['metric', 'imperial'] as const

type AuthEnv = {
    Variables: {
        user: any
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAuth)

const preferencesSchema = z.object({
    locale: z.enum(SUPPORTED_LOCALES).optional(),
    timezone: z.string().min(1).optional(),
    unitSystem: z.enum(SUPPORTED_UNIT_SYSTEMS).optional(),
}).refine(
    (data) => data.locale !== undefined || data.timezone !== undefined || data.unitSystem !== undefined,
    { message: 'At least one preference field must be provided' },
)

app.patch('/preferences', zValidator('json', preferencesSchema), async (c) => {
    const sessionUser = c.get('user')
    const { locale, timezone, unitSystem } = c.req.valid('json')

    await db
        .update(user)
        .set({
            ...(locale !== undefined && { locale }),
            ...(timezone !== undefined && { timezone }),
            ...(unitSystem !== undefined && { unitSystem }),
        })
        .where(eq(user.id, sessionUser.id))

    return c.body(null, 204)
})

export default app
