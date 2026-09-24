import { beforeEach, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import db from '../src/db/db.js'

vi.mock('../src/lib/email.js', () => ({
    sendEmail: vi.fn(async () => ({ success: true })),
}))

beforeEach(async () => {
    const { rows } = await db.execute<{ tablename: string }>(
        sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    )
    if (rows.length === 0) return
    const tables = rows.map((r) => `"${r.tablename}"`).join(', ')
    await db.execute(sql.raw(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`))
})
