import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { handle } from '@hono/node-server/vercel'
import { t, negotiateFromHeader } from './i18n/index.js'

// Import Routes
import { auth } from './lib/auth.js'
import habitRoutes from './routes/app/habits.js'
import trackerRoutes from './routes/app/tracker.js'
import exerciseInfoRoutes from './routes/app/exercise-info/index.js'
import exerciseListRoutes from './routes/app/exercise-lists.js'
import exerciseSourceRoutes from './routes/app/exercise-sources.js'
import configRoutes from './routes/app/config.js'
import issueRoutes from './routes/app/issues.js'
import preferencesRoutes from './routes/app/preferences.js'
import inviteRoutes from './routes/admin/invites.js'
import adminSettingsRoutes from './routes/admin/settings.js'
import adminExerciseRoutes from './routes/admin/exercises.js'
import adminIssueRoutes from './routes/admin/issues.js'
import adminLimitsRoutes from './routes/admin/limits.js'

const app = new Hono()

console.log('Starting Backend Server...')
console.log('Allowed Origins:', [process.env.FRONT_URL || 'http://localhost:5173', process.env.ADMIN_URL || 'http://localhost:5173'])
// 1. Global Middleware
app.use('*', logger())

// 2. Auth Route (Better-Auth)
// Hono handles the raw request mapping easily
app.use('/api/auth/*', cors({
    origin: [process.env.FRONT_URL || 'http://localhost:5173', process.env.ADMIN_URL || 'http://localhost:5173'],
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
}))
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
app.route('/api/exercise-lists', exerciseListRoutes)
app.route('/api/exercise-sources', exerciseSourceRoutes)
app.route('/api/config', configRoutes)
app.route('/api/issues', issueRoutes)
app.route('/api/me', preferencesRoutes)

// Admin Routes
app.use('/admin/*', cors({
    origin: process.env.ADMIN_URL || 'http://localhost:5173',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/admin/invitations', inviteRoutes)
app.route('/admin/settings', adminSettingsRoutes)
app.route('/admin/exercises', adminExerciseRoutes)
app.route('/admin/issues', adminIssueRoutes)
app.route('/admin/limits', adminLimitsRoutes)

// 4. Health Check
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }))

// 5. Not Found Handler
app.notFound((c) => {
    const locale = negotiateFromHeader(c.req.header('accept-language'))
    return c.json({ message: t('errors', 'route_not_found', locale) }, 404)
})

// 6. Error Handler
app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return err.getResponse();
    }
    console.error('Unhandled error:', err);
    const locale = negotiateFromHeader(c.req.raw.headers.get('accept-language') ?? undefined)
    return c.json({ error: t('errors', 'internal_server_error', locale) }, 500);
});

//TODO check if cannot export directly, wronly changed bc bad mistakenly infer error cause.
export default handle(app)

export { app }