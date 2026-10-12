// Postgres unique violations surface as `code === '23505'` with the offending
// constraint name; node-postgres nests the original error under `cause`.
export function isUniqueViolation(err: unknown, constraint: string): boolean {
    const e = err as { code?: string; constraint?: string; cause?: unknown }
    if (e?.code === '23505' && e?.constraint === constraint) return true
    if (e?.cause) return isUniqueViolation(e.cause, constraint)
    return false
}

/** A CHECK, or a trigger raising `check_violation` under [constraint]'s name, failed. */
export function isCheckViolation(err: unknown, constraint: string): boolean {
    const e = err as { code?: string; constraint?: string; cause?: unknown }
    if (e?.code === '23514' && e?.constraint === constraint) return true
    if (e?.cause) return isCheckViolation(e.cause, constraint)
    return false
}

/** A row named by [constraint]'s foreign key doesn't exist. */
export function isForeignKeyViolation(err: unknown, constraint: string): boolean {
    const e = err as { code?: string; constraint?: string; cause?: unknown }
    if (e?.code === '23503' && e?.constraint === constraint) return true
    if (e?.cause) return isForeignKeyViolation(e.cause, constraint)
    return false
}
