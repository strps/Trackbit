import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { EXERCISE_SOURCE_KEY_PATTERN, parseSourceKey } from '@trackbit/types'
import { requireAuth } from '../../middleware/auth.js'
import { localeMiddleware } from '../../middleware/locale.js'
import { t } from '../../i18n/index.js'
import { listExerciseSources, resolveExerciseSource } from '../../lib/exercise-sources.js'

type AuthEnv = {
    Variables: {
        user: any
        locale: string
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAuth)
app.use('*', localeMiddleware)

// Built from the shared pattern so the two ends can't drift on key format.
const sourceKeySchema = z.object({
    key: z.string().regex(EXERCISE_SOURCE_KEY_PATTERN),
})

// GET /api/exercise-sources — the descriptors the picker lists.
app.get('/', async (c) => {
    const user = c.get('user')
    return c.json(await listExerciseSources(user.id, user.role))
})

// GET /api/exercise-sources/:key — the resolved queue for one source.
//
// Unknown, unowned and dangling refs all answer 404 rather than throwing: the
// client treats that as "fall back to browse mode" and clears its stored
// preference, which is what keeps a deleted list from wedging the picker.
app.get('/:key', zValidator('param', sourceKeySchema), async (c) => {
    const user = c.get('user')
    const { key } = c.req.valid('param')

    const ref = parseSourceKey(key)
    if (!ref) {
        return c.json({ error: t('errors', 'exercise_source_not_found', c.get('locale')) }, 404)
    }

    const resolved = await resolveExerciseSource(user.id, user.role, ref)
    if (!resolved) {
        return c.json({ error: t('errors', 'exercise_source_not_found', c.get('locale')) }, 404)
    }

    return c.json(resolved)
})

export default app
