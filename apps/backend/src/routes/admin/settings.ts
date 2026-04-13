import { Hono } from 'hono'
import { requireAdminAuth } from '../../middleware/require-admin-auth.js'
import db from '../../db/db.js'
import { appSettings } from '../../db/schema/app/settings.js'
import { eq } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

type AuthEnv = {
    Variables: {
        user: any
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAdminAuth)

// GET /admin/settings — fetch current app settings
app.get('/', async (c) => {
    const [settings] = await db.select().from(appSettings).limit(1)

    if (!settings) {
        return c.json({ error: 'App settings not found' }, 404)
    }

    return c.json(settings)
})

const updateSettingsSchema = z.object({
    googleLoginEnabled: z.boolean().optional(),
    githubLoginEnabled: z.boolean().optional(),
    passwordLoginEnabled: z.boolean().optional(),
})

// PUT /admin/settings — update app settings
app.put('/', zValidator('json', updateSettingsSchema), async (c) => {
    const body = c.req.valid('json')

    const [settings] = await db.select().from(appSettings).limit(1)
    if (!settings) {
        return c.json({ error: 'App settings not found' }, 404)
    }

    const [updated] = await db
        .update(appSettings)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(appSettings.id, settings.id))
        .returning()

    return c.json(updated)
})

export default app
