import type { FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { ProjectStatus } from '@cop1/domain';

/**
 * Projects routes
 */
export async function projectsRoutes(
  fastify: FastifyInstance,
  options: { container: Container },
) {
  const { container } = options;

  // GET /projects - List all projects
  fastify.get('/projects', async () => {
    const projects = await container.projectRepository.findAll();
    return projects;
  });

  // GET /projects/:id - Get project by ID
  fastify.get<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const project = await container.projectRepository.findById(request.params.id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    return project;
  });

  // POST /projects - Create a new project
  fastify.post<{
    Body: { name: string; description: string; metadata?: Record<string, unknown> };
  }>('/projects', async (request, reply) => {
    const { name, description, metadata } = request.body;

    if (!name || !description) {
      return reply.status(400).send({ error: 'Name and description are required' });
    }

    const project = await container.createProject.execute({
      name,
      description,
      metadata,
    });

    return reply.status(201).send(project);
  });

  // PATCH /projects/:id/pause - Pause a project
  fastify.patch<{ Params: { id: string } }>(
    '/projects/:id/pause',
    async (request, reply) => {
      const project = await container.projectRepository.findById(request.params.id);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      project.pause();
      await container.projectRepository.save(project);

      return project;
    },
  );

  // PATCH /projects/:id/resume - Resume a project
  fastify.patch<{ Params: { id: string } }>(
    '/projects/:id/resume',
    async (request, reply) => {
      const project = await container.projectRepository.findById(request.params.id);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      project.resume();
      await container.projectRepository.save(project);

      return project;
    },
  );
}
