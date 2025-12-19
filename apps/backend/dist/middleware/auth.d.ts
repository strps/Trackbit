import { auth } from '../lib/auth';
type Env = {
    Variables: {
        user: typeof auth.$Infer.Session.user;
        session: typeof auth.$Infer.Session.session;
    };
};
export declare const requireAuth: import("hono").MiddlewareHandler<Env, string, {}, Response>;
export {};
//# sourceMappingURL=auth.d.ts.map