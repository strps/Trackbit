import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

// Import Routes
import { auth } from './lib/auth'
import habitRoutes from './routes/habits'
import logRoutes from './routes/logs'
import exerciseRoutes from './routes/exercises'
import sessionRouter from './routes/sessions'
import configRoutes from './routes/config'

const app = new Hono()

// 1. Global Middleware
app.use('*', logger())
app.use('*', cors({
    origin: 'http://localhost:5173',
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
app.route("/api/logs/exercise-sessions", sessionRouter)

// 4. Health Check
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }))

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
    fetch: app.fetch,
    port
})