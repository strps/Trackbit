import * as schema from './schema/index.js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
declare const db: NodePgDatabase<typeof schema>;
export default db;
//# sourceMappingURL=db.d.ts.map