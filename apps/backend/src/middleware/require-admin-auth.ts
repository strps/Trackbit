import { createMiddleware } from 'hono/factory'
import { auth } from '../lib/auth.js'

type Env = {
    Variables: {
        user: typeof auth.$Infer.Session.user
        session: typeof auth.$Infer.Session.session
    }
}

export const requireAdminAuth = createMiddleware<Env>(async (c, next) => {
    console.log(c.req.raw.headers);
    const session = await auth.api.getSession({
        headers: (c.req.raw as any).headers
    })

    console.log("Admin auth middleware - session:", session);
    // Check if session exists and if the role is 'admin'
    if (!session || session.user.role !== 'admin') {
        //TODO: Log unauthorized access attempt
        return c.json({ error: 'Unauthorized: Admin access required' }, 403);
    }
    // Set user/session in Context for routes to use
    c.set('user', session.user)
    c.set('session', session.session)

    await next()
})