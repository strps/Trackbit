import { Hono } from 'hono'
import { requireAuth } from '../../middleware/auth.js'

type AuthEnv = {
    Variables: {
        user: any
    }
}

const app = new Hono<AuthEnv>()

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