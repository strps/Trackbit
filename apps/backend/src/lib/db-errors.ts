// Postgres unique violations surface as `code === '23505'` with the offending
// constraint name; node-postgres nests the original error under `cause`.
export function isUniqueViolation(err: unknown, constraint: string): boolean {
    const e = err as { code?: string; constraint?: string; cause?: unknown }
    if (e?.code === '23505' && e?.constraint === constraint) return true
    if (e?.cause) return isUniqueViolation(e.cause, constraint)
    return false
}
