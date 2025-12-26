import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

// Import Routes
import { auth } from './lib/auth.js'
import habitRoutes from './routes/habits.js'
import logRoutes from './routes/logs.js'
import exerciseRoutes from './routes/exercises.js'
import sessionRouter from './routes/sessions.js'
import configRoutes from './routes/config.js'

const app = new Hono()

// 1. Global Middleware
app.use('*', logger())
app.use('*', cors({
    origin: process.env.FRONT_URL!,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
}))

// 2. Auth Route (Better-Auth)
// Hono handles the raw request mapping easily
app.all('/api/auth/*', async (c) => {
    return auth.handler(c.req.raw)
})

// 3. Application Routes
app.route('/api/habits', habitRoutes)
app.route('/api/logs', logRoutes)
app.route('/api/exercises', exerciseRoutes)
app.route('/api/config', configRoutes)
app.route("/api/exercise-sessions", sessionRouter)

// 4. Health Check
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }))

// ✅ LOCAL ONLY
if (!process.env.VERCEL) {
    const port = 3000;
    console.log(`Server running on http://localhost:${port}`);
    serve({
        fetch: app.fetch,
        port,
    });
}

export default app