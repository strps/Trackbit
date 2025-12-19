/**
 * Rate limiting middleware for Hono.
 *
 * Configurable per-route or globally.
 * Uses in-memory rate limiter (suitable for single-instance deployments).
 * For distributed environments (e.g., Cloudflare Workers, multi-instance Node), replace with Redis or similar.
 *
 * Default: 100 requests per 60 seconds per IP.
 */
export declare function rateLimit(options?: {
    limit?: number;
    duration?: number;
    keyPrefix?: string;
}): (c: any, next: () => Promise<void>) => Promise<any>;
//# sourceMappingURL=rateLimit.d.ts.map