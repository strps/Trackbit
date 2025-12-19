"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const factory_1 = require("hono/factory");
const auth_1 = require("../lib/auth");
exports.requireAuth = (0, factory_1.createMiddleware)(async (c, next) => {
    const session = await auth_1.auth.api.getSession({
        headers: c.req.raw.headers
    });
    if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    // Set user/session in Context for routes to use
    c.set('user', session.user);
    c.set('session', session.session);
    await next();
});
//# sourceMappingURL=auth.js.map