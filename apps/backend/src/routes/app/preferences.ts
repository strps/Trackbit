import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z, type ZodError } from 'zod'
import { eq, count } from 'drizzle-orm'
import db from '../../db/db.js'
import { user } from '../../db/schema/app/user.js'
import { habits } from '../../db/schema/app/habits.js'
import { exercises } from '../../db/schema/app/exercises.js'
import { exerciseLists } from '../../db/schema/app/exercise-lists.js'
import { requireAuth } from '../../middleware/auth.js'
import { localeMiddleware } from '../../middleware/locale.js'
import { formatZodError } from '../../lib/utils.js'
import { getEffectiveLimits } from '../../lib/user-limits.js'

const SUPPORTED_LOCALES = ['en', 'es'] as const
const SUPPORTED_UNIT_SYSTEMS = ['metric', 'imperial'] as const
const SUPPORTED_CARD_STYLES = ['classic', 'compact'] as const

type AuthEnv = {
    Variables: {
        user: any
        locale: string
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAuth)
app.use('*', localeMiddleware)

const preferencesSchema = z.object({
    locale: z.enum(SUPPORTED_LOCALES).optional(),
    timezone: z.string().min(1).optional(),
    unitSystem: z.enum(SUPPORTED_UNIT_SYSTEMS).optional(),
    exerciseLogCardStyle: z.enum(SUPPORTED_CARD_STYLES).optional(),
}).refine(
    (data) =>
        data.locale !== undefined ||
        data.timezone !== undefined ||
        data.unitSystem !== undefined ||
        data.exerciseLogCardStyle !== undefined,
    { message: 'At least one preference field must be provided' },
)

app.patch('/preferences', zValidator('json', preferencesSchema, (result, c) => {
    if (!result.success) {
        return c.json(formatZodError(result.error as ZodError, ((c as any).get('locale') as string | undefined) ?? 'en'), 400)
    }
}), async (c) => {
    const sessionUser = c.get('user')
    const { locale, timezone, unitSystem, exerciseLogCardStyle } = c.req.valid('json')

    await db
        .update(user)
        .set({
            ...(locale !== undefined && { locale }),
            ...(timezone !== undefined && { timezone }),
            ...(unitSystem !== undefined && { unitSystem }),
            ...(exerciseLogCardStyle !== undefined && { exerciseLogCardStyle }),
        })
        .where(eq(user.id, sessionUser.id))

    return c.body(null, 204)
})

app.get('/limits', async (c) => {
    const sessionUser = c.get('user')
    const effective = await getEffectiveLimits(sessionUser.role)

    const [{ value: habitsCount }] = await db
        .select({ value: count() })
        .from(habits)
        .where(eq(habits.userId, sessionUser.id))

    const [{ value: customExercisesCount }] = await db
        .select({ value: count() })
        .from(exercises)
        .where(eq(exercises.userId, sessionUser.id))

    const [{ value: exerciseListsCount }] = await db
        .select({ value: count() })
        .from(exerciseLists)
        .where(eq(exerciseLists.userId, sessionUser.id))

    return c.json({
        effective,
        counts: {
            habits: habitsCount,
            customExercises: customExercisesCount,
            exerciseLists: exerciseListsCount,
        },
    })
})

export default app
