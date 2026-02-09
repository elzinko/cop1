import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Container } from './container.js';
import { projectsRoutes } from './routes/projects.js';
import { agentsRoutes } from './routes/agents.js';
import { tasksRoutes } from './routes/tasks.js';

export interface ServerConfig {
  port: number;
  host: string;
  dbPath: string;
}

export async function createServer(config: ServerConfig) {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // CORS
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
  });

  // Initialize container (DI)
  const container = new Container(config.dbPath);

  // Register routes
  await fastify.register(projectsRoutes, { container, prefix: '/api' });
  await fastify.register(agentsRoutes, { container, prefix: '/api' });
  await fastify.register(tasksRoutes, { container, prefix: '/api' });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Start server
  await fastify.listen({ port: config.port, host: config.host });

  return fastify;
}
