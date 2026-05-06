import { createMiddleware } from 'hono/factory'
import { auth } from '../lib/auth.js'
import { t, negotiateFromHeader } from '../i18n/index.js'

type Env = {
    Variables: {
        user: typeof auth.$Infer.Session.user
        session: typeof auth.$Infer.Session.session
    }
}

export const requireAuth = createMiddleware<Env>(async (c, next) => {
    const session = await auth.api.getSession({
        headers: (c.req.raw as any).headers
    })

    if (!session) {
        const locale = negotiateFromHeader(c.req.header('accept-language'))
        return c.json({ error: t('errors', 'unauthorized', locale) }, 401)
    }

    // Set user/session in Context for routes to use
    c.set('user', session.user)
    c.set('session', session.session)

    await next()
})