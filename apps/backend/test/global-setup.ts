import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { pushSchema } from 'drizzle-kit/api'
import * as schema from '../src/db/schema/index.js'

// Rebuilds the test database from the Drizzle schema on every run, so tests
// never depend on the state a previous run left behind.
export default async function setup() {
    const url = process.env.TEST_DATABASE_URL!
    const db = drizzle(url)
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`)
    await db.execute(sql`CREATE SCHEMA public`)
    const { apply } = await pushSchema(schema, db as any)
    await apply()
    await db.$client.end()
}
