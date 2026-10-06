import { Hono } from 'hono'
import { validator } from '../../lib/validator.js'
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

// The report form's rules (web and Android `IssueRules`). Text is stored trimmed; a blank
// optional field (omitted, null or blank) is stored as null.
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((s) => s || null)

const issueBodySchema = z.object({
    type: z.enum(['bug', 'feedback']).default('bug'),
    title: optionalText(255),
    path: optionalText(500),
    client: optionalText(255),
    description: z.string().trim().min(1).max(5000),
    stackTrace: optionalText(20_000),
}).strict()

app.post(
    '/',
    validator('json', issueBodySchema),
    async (c) => {
        const user = c.get('user')
        const body = c.req.valid('json')

        const [issue] = await db.insert(issues).values({
            ...body,
            userId: user.id,
        }).returning()

        return c.json(issue, 201)
    }
)

export default app
