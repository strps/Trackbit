import { createMiddleware } from 'hono/factory'
import { auth } from '../lib/auth'

type Env = {
    Variables: {
        user: typeof auth.$Infer.Session.user
        session: typeof auth.$Infer.Session.session
    }
}

export const requireAuth = createMiddleware<Env>(async (c, next) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers as Headers
    })

    if (!session) {
        return c.json({ error: "Unauthorized" }, 401)
    }

    // Set user/session in Context for routes to use
    c.set('user', session.user)
    c.set('session', session.session)

    await next()
})