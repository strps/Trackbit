// backend/src/middleware/rateLimit.ts
import { Hono } from 'hono';
import { getConnInfo } from 'hono/cloudflare-workers'; // Adjust based on runtime; for Node.js, use a different identifier
import { RateLimiterMemory } from 'rate-limiter-flexible';

/**
 * Rate limiting middleware for Hono.
 * 
 * Configurable per-route or globally.
 * Uses in-memory rate limiter (suitable for single-instance deployments).
 * For distributed environments (e.g., Cloudflare Workers, multi-instance Node), replace with Redis or similar.
 * 
 * Default: 100 requests per 60 seconds per IP.
 */
export function rateLimit(options: {
    limit?: number; // Requests allowed
    duration?: number; // In seconds
    keyPrefix?: string; // For namespacing (e.g., per route)
} = {}) {
    const { limit = 100, duration = 60, keyPrefix = 'global' } = options;

    const rateLimiter = new RateLimiterMemory({
        points: limit,
        duration,
        keyPrefix,
    });

    return async (c: any, next: () => Promise<void>) => {
        // Identify client: Use IP from Cloudflare, X-Forwarded-For, or connection remote address
        const info = getConnInfo(c);
        const ip = info.remote.address ?? c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

        const key = `${keyPrefix}:${ip}`;

        try {
            await rateLimiter.consume(key, 1);
            await next();
        } catch (rej: any) {
            if (rej instanceof Error) throw rej; // Unexpected error

            const retrySecs = Math.round(rej.msBeforeNext / 1000) || 1;

            c.header('Retry-After', String(retrySecs));
            c.header('X-RateLimit-Limit', String(limit));
            c.header('X-RateLimit-Remaining', String(rej.remainingPoints));
            c.header('X-RateLimit-Reset', String(Math.floor((Date.now() + rej.msBeforeNext) / 1000)));

            return c.json({ error: 'Too many requests' }, 429);
        }
    };
}