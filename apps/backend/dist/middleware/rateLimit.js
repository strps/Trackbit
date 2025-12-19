"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
const cloudflare_workers_1 = require("hono/cloudflare-workers"); // Adjust based on runtime; for Node.js, use a different identifier
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
/**
 * Rate limiting middleware for Hono.
 *
 * Configurable per-route or globally.
 * Uses in-memory rate limiter (suitable for single-instance deployments).
 * For distributed environments (e.g., Cloudflare Workers, multi-instance Node), replace with Redis or similar.
 *
 * Default: 100 requests per 60 seconds per IP.
 */
function rateLimit(options = {}) {
    const { limit = 100, duration = 60, keyPrefix = 'global' } = options;
    const rateLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
        points: limit,
        duration,
        keyPrefix,
    });
    return async (c, next) => {
        // Identify client: Use IP from Cloudflare, X-Forwarded-For, or connection remote address
        const info = (0, cloudflare_workers_1.getConnInfo)(c);
        const ip = info.remote.address ?? c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
        const key = `${keyPrefix}:${ip}`;
        try {
            await rateLimiter.consume(key, 1);
            await next();
        }
        catch (rej) {
            if (rej instanceof Error)
                throw rej; // Unexpected error
            const retrySecs = Math.round(rej.msBeforeNext / 1000) || 1;
            c.header('Retry-After', String(retrySecs));
            c.header('X-RateLimit-Limit', String(limit));
            c.header('X-RateLimit-Remaining', String(rej.remainingPoints));
            c.header('X-RateLimit-Reset', String(Math.floor((Date.now() + rej.msBeforeNext) / 1000)));
            return c.json({ error: 'Too many requests' }, 429);
        }
    };
}
//# sourceMappingURL=rateLimit.js.map