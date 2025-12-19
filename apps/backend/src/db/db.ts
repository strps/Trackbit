import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

const db: NodePgDatabase<typeof schema> = drizzle(process.env.DATABASE_URL!, { schema });

export default db;