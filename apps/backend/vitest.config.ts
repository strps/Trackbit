import { defineConfig } from 'vitest/config'

// Local runs read TEST_DATABASE_URL from .env.test; CI sets it directly.
try { process.loadEnvFile('.env.test') } catch { /* no file: rely on the environment */ }

const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required to run backend tests (see apps/backend/.env.test)')
}

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        globalSetup: ['test/global-setup.ts'],
        setupFiles: ['test/setup.ts'],
        // Every test file shares one database and truncates it between tests.
        fileParallelism: false,
        env: {
            DATABASE_URL: testDatabaseUrl,
            BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-00',
            SERVER_URL: 'http://localhost:3000',
            RESEND_API_KEY: '',
        },
    },
})
