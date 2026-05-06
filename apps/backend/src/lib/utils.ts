import { ZodError } from "zod";
import { t } from '../i18n/index.js';

export const formatZodError = (error: ZodError, locale = 'en') => {
    return {
        message: t('errors', 'validation_failed', locale),
        errors: error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
        })),
    };
}