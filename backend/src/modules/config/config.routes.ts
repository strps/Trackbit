import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../../utils/auth';

// Define the static structure for the navigation links
const navItemSchema = z.object({
    title: z.string(),
    href: z.string(),
    icon: z.string(), // Use string to map to Lucide icons on the frontend
    active: z.boolean().optional(),
});

const configRoutes: FastifyPluginAsyncZod = async (app) => {
    // This endpoint should require authentication to personalize the response
    app.addHook('preHandler', requireAuth);

    // GET /api/config/ui
    app.get('/ui', {
        schema: {
            response: {
                200: z.object({
                    // Global settings
                    appName: z.string(),
                    isBetaUser: z.boolean(),

                    // Primary navigation structure
                    primaryNav: z.array(navItemSchema),

                    // User dashboard feature flags
                    dashboardWidgets: z.array(z.string()),
                })
            }
        }
    }, async (request) => {
        // In a real app, 'isBetaUser' could be determined by the user's role in the DB.
        const user = (request as any).user;

        return {
            appName: "MomentumTrack",
            isBetaUser: true, // Example flag

            primaryNav: [
                { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", active: true },
                { title: "Habits", href: "/habits", icon: "ListTodo" },
                { title: "Library", href: "/exercises", icon: "Dumbbell" },
                { title: "Analytics", href: "/analytics", icon: "BarChart3" },
                // Example of a conditional link based on role:
                ...(user.email === "admin@example.com" ? [{ title: "Admin", href: "/admin", icon: "Shield", active: false }] : []),
            ],

            dashboardWidgets: [
                "Streak",
                "WeeklyGoals",
                "NegativeHabitsSummary"
            ]
        };
    });
}

export default configRoutes;