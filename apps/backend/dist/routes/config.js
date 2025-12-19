"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const auth_1 = require("../middleware/auth");
const app = new hono_1.Hono();
app.use('*', auth_1.requireAuth);
// GET /api/config/ui
app.get('/ui', async (c) => {
    const user = c.get('user');
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
    });
});
exports.default = app;
//# sourceMappingURL=config.js.map