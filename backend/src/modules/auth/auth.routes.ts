import { FastifyInstance } from 'fastify';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../../lib/auth';

const frontendUrl = "http://localhost:5173";

export default async function authRoutes(app: FastifyInstance) {
  // CRITICAL FIX: Remove default parsers so Fastify doesn't consume the stream
  // This allows Better-Auth to read the raw request body itself.
  app.removeAllContentTypeParsers();

  // Add a "catch-all" parser that does nothing, ensuring the stream is left alone
  app.addContentTypeParser('*', (req, payload, done) => {
    done(null, payload);
  });

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      const handler = toNodeHandler(auth);

      // Force CORS headers onto the raw response object
      // This ensures the browser accepts the answer even if Fastify's hook is skipped TODO: verify if this is still needed with Fastify's CORS plugin
      reply.raw.setHeader('Access-Control-Allow-Origin', frontendUrl);
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
      reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      return handler(request.raw, reply.raw);
    }
  });
}