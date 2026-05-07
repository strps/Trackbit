import { Hono } from 'hono'
import { requireAuth } from '../../middleware/auth.js'
import { getOrCreateAppSettings } from '../../lib/app-settings.js'

type AuthEnv = {
    Variables: {
        user: any
    }
}

const app = new Hono<AuthEnv>()

// Public route — no auth required (needed on login/signup pages)
app.get('/auth-settings', async (c) => {
    const settings = await getOrCreateAppSettings()
    return c.json({
        googleLoginEnabled: settings.googleLoginEnabled,
        githubLoginEnabled: settings.githubLoginEnabled,
        passwordLoginEnabled: settings.passwordLoginEnabled,
    })
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