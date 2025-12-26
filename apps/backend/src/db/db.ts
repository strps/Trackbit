import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
import { sql } from '@vercel/postgres'

const db = drizzle(sql, { schema });

export default db;