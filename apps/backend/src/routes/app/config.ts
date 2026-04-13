import { Hono } from 'hono'
import { requireAuth } from '../../middleware/auth.js'
import db from '../../db/db.js'
import { appSettings } from '../../db/schema/index.js'

type AuthEnv = {
    Variables: {
        user: any
    }
}

const app = new Hono<AuthEnv>()

// Public route — no auth required (needed on login/signup pages)
app.get('/auth-settings', async (c) => {
    const [settings] = await db.select({
        googleLoginEnabled: appSettings.googleLoginEnabled,
        githubLoginEnabled: appSettings.githubLoginEnabled,
        passwordLoginEnabled: appSettings.passwordLoginEnabled,
    }).from(appSettings).limit(1)

    if (!settings) {
        return c.json({
            googleLoginEnabled: true,
            githubLoginEnabled: true,
            passwordLoginEnabled: true,
        })
    }

    return c.json(settings)
})

// Protected routes
app.use('*', requireAuth)

// GET /api/config/ui
app.get('/ui', async (c) => {
    const user = c.get('user')

    return c.json({
        appName: "MomentumTrack",
        isBetaUser: true,

        primaryNav: [
            { title: "Tracker", href: "/tracker", icon: "Flame", active: true },
            { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
            { title: "Habits", href: "/config/habits", icon: "ListTodo" },
            { title: "Library", href: "/config/exercises", icon: "Dumbbell" },
            { title: "Stats", href: "/stats", icon: "BarChart3" },
            // Example conditional logic
            // ...(user.email === "admin@example.com" ? [{ title: "Admin", href: "/admin", icon: "Shield" }] : []),
        ],

        dashboardWidgets: [
            "Streak",
            "WeeklyGoals",
            "NegativeHabitsSummary"
        ]
    })
})

export default app