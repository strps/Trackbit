import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { handle } from '@hono/node-server/vercel'

// Import Routes
import { auth } from './lib/auth.js'
import habitRoutes from './routes/app/habits.js'
import trackerRoutes from './routes/app/tracker.js'
import exerciseInfoRoutes from './routes/app/exercise-info/index.js'
import configRoutes from './routes/app/config.js'
import inviteRoutes from './routes/admin/invites.js'

const app = new Hono()

console.log('Starting Backend Server...')
console.log('Allowed Origins:', process.env.ALLOWED_ORIGINS)
// 1. Global Middleware
app.use('*', logger())

// 2. Auth Route (Better-Auth)
// Hono handles the raw request mapping easily
app.all('/api/auth/*', async (c) => {
    return auth.handler(c.req.raw)
})

// 3. Application Routes
app.use('/api/*', cors({
    origin: process.env.FRONT_URL || 'http://localhost:5173',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/api/habits', habitRoutes)
app.route('/api/tracker', trackerRoutes)
app.route('/api/exercise-info', exerciseInfoRoutes)
app.route('/api/config', configRoutes)

// Admin Routes
app.use('/admin/*', cors({
    origin: process.env.ADMIN_URL || 'http://localhost:5173',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/admin/invitations', inviteRoutes)

// 4. Health Check
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }))

// 5. Not Found Handler
app.notFound((c) => {
    return c.json({ message: 'Route not found' }, 404)
})

// 6. Error Handler
app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
});

//TODO check if cannot export directly, wronly changed bc bad mistakenly infer error cause.
export default handle(app)

export { app }