import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'

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
            { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", active: true },
            { title: "Habits", href: "/habits", icon: "ListTodo" },
            { title: "Library", href: "/exercises", icon: "Dumbbell" },
            { title: "Analytics", href: "/analytics", icon: "BarChart3" },
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