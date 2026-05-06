import { createMiddleware } from 'hono/factory';
import { negotiateFromHeader, type SupportedLocale } from '../i18n/index.js';
import { auth } from '../lib/auth.js';

type Env = {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
    locale: SupportedLocale;
  };
};

export const localeMiddleware = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user') as { locale?: string } | undefined;
  const locale =
    (user?.locale as SupportedLocale | undefined) ??
    negotiateFromHeader(c.req.header('accept-language'));
  c.set('locale', locale);
  await next();
});
