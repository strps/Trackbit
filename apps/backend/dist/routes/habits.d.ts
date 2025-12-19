import { Hono } from 'hono';
type AuthEnv = {
    Variables: {
        user: any;
    };
};
declare const app: Hono<AuthEnv, import("hono/types").BlankSchema, "/">;
export default app;
//# sourceMappingURL=habits.d.ts.map