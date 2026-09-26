import type { Context } from 'hono';
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

/**
 * The locale to answer in: the one already resolved for this request, else the signed-in
 * user's, else the Accept-Language header's. Works on routes without localeMiddleware.
 */
export function localeFor(c: Context): SupportedLocale {
  const resolved = c.get('locale') as SupportedLocale | undefined;
  if (resolved) return resolved;
  const user = c.get('user') as { locale?: string } | undefined;
  return (user?.locale as SupportedLocale | undefined) ?? negotiateFromHeader(c.req.header('accept-language'));
}

export const localeMiddleware = createMiddleware<Env>(async (c, next) => {
  c.set('locale', localeFor(c));
  await next();
});
