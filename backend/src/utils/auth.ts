import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../lib/auth'; // Import your better-auth config

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const session = await auth.api.getSession({
        headers: request.headers
    });

    if (!session) {
        return reply.status(401).send({ error: "Unauthorized" });
    }

    // Attach user to request for use in routes
    (request as any).user = session.user;
}