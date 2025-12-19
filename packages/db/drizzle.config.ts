import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Path to your schema file
  schema: './src/db/schema',
  // Where migration SQL files will be output
  out: './drizzle',
  // The database dialect
  dialect: 'postgresql',
  // Credentials for introspection/pushing
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Print all SQL statements to console during migration generation (optional)
  verbose: true,
  // Ask for confirmation before running destructive changes
  strict: true,
});