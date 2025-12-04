import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';

// Import your routes
import authRoutes from './modules/auth/auth.routes';
import habitRoutes from './modules/habits/habits.routes';
import exerciseRoutes from './modules/habits/exercises.routes';
import logRoutes from './modules/habits/logs.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      // level: 'debug', // Change from true to an object with level
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: true,
          ignore: 'pid,hostname'
        }
      }
    }
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 1. Setup CORS
  // We explicitly set origin and credentials. 
  await app.register(cors, {
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Required for cookies
  });


  // 3. Register Type Provider
  const appWithZod = app.withTypeProvider<ZodTypeProvider>();

  // 4. Register Routes

  // Health Check
  appWithZod.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Auth Routes (Better-Auth)
  // Handles /api/auth/* (login, signup, session, etc.)
  app.register(authRoutes);

  // Business Logic Routes
  appWithZod.register(habitRoutes, { prefix: '/api/habits' });
  appWithZod.register(exerciseRoutes, { prefix: '/api/exercises' });
  appWithZod.register(logRoutes, { prefix: '/api/logs' });


  return app;
}