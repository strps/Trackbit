import { ZodError } from "zod";

export const formatZodError = (error: ZodError) => {

    return {
        message: 'Validation failed',
        errors: error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
            // expected: issue.expected ?? undefined,
            // received: issue.received ?? undefined,
        })),
    };
}