import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
import { sql } from '@vercel/postgres'

let db: NodePgDatabase<typeof schema> | null = null;


if (process.env.VERCEL) {
    db = drizzle(sql, { schema });
} else if (process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'development') console.log("DB connected to:", process.env.DATABASE_URL);
    db = drizzle(process.env.DATABASE_URL, { schema });
}

if (!db) {
    throw new Error("Database connection not established.");
}

export default db as NodePgDatabase<typeof schema>;