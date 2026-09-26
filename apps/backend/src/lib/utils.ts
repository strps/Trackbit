import type { $ZodError } from "zod/v4/core";
import { t } from '../i18n/index.js';

/** The documented 400 body: `{ message, errors: [{ path, message, code }] }`. */
export const formatZodError = (error: Pick<$ZodError, 'issues'>, locale = 'en') => {
    return {
        message: t('errors', 'validation_failed', locale),
        errors: error.issues.map(issue => ({
            path: issue.path.map(String).join('.'),
            message: issue.message,
            code: issue.code,
        })),
    };
}
