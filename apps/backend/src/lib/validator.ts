import type { ValidationTargets } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { ZodType } from 'zod'
import { formatZodError } from './utils.js'
import { localeFor } from '../middleware/locale.js'

/**
 * The one way routes validate input. A failure is always a 400 with the documented body,
 * `{ message, errors: [{ path, message, code }] }`, with `message` localized.
 *
 * Don't import `zValidator` from `@hono/zod-validator` directly: without this hook it answers
 * `{ success: false, error: <ZodError> }`, which clients read as `[object Object]`.
 * test/validator.test.ts fails the build if a route does.
 */
export const validator = <T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
    zValidator(target, schema, (result, c) => {
        if (!result.success) {
            return c.json(formatZodError(result.error, localeFor(c)), 400)
        }
    })
