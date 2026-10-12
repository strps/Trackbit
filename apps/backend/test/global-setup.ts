import { readdirSync, readFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { pushSchema } from 'drizzle-kit/api'
import * as schema from '../src/db/schema/index.js'

const SQL_DIR = new URL('../src/db/sql/', import.meta.url)

// Rebuilds the test database from the Drizzle schema on every run, so tests
// never depend on the state a previous run left behind. Then applies what the
// schema can't express (triggers in src/db/sql), which migrations carry verbatim.
export default async function setup() {
    const url = process.env.TEST_DATABASE_URL!
    const db = drizzle(url)
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`)
    await db.execute(sql`CREATE SCHEMA public`)
    const { apply } = await pushSchema(schema, db as any)
    await apply()
    for (const file of readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort()) {
        for (const statement of readFileSync(new URL(file, SQL_DIR), 'utf8').split('--> statement-breakpoint')) {
            await db.execute(sql.raw(statement))
        }
    }
    await db.$client.end()
}
