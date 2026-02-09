import type { FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { TaskPriority, type TaskMetadata } from '@cop1/domain';

/**
 * Tasks routes
 */
export async function tasksRoutes(
  fastify: FastifyInstance,
  options: { container: Container },
) {
  const { container } = options;

  // GET /tasks - List all tasks (with optional filters)
  fastify.get<{
    Querystring: { projectId?: string; status?: string; agentId?: string };
  }>('/tasks', async (request) => {
    const { projectId, status, agentId } = request.query;

    if (projectId) {
      return container.taskRepository.findByProjectId(projectId);
    }

    if (status) {
      return container.taskRepository.findByStatus(status as any);
    }

    if (agentId) {
      return container.taskRepository.findByAgentId(agentId);
    }

    // For now, return pending tasks by default
    return container.taskRepository.findPendingTasks();
  });

  // GET /tasks/:id - Get task by ID
  fastify.get<{ Params: { id: string } }>('/tasks/:id', async (request, reply) => {
    const task = await container.taskRepository.findById(request.params.id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    return task;
  });

  // POST /tasks - Create a new task
  fastify.post<{
    Body: {
      title: string;
      description: string;
      projectId: string;
      priority: TaskPriority;
      metadata?: TaskMetadata;
    };
  }>('/tasks', async (request, reply) => {
    const { title, description, projectId, priority, metadata } = request.body;

    if (!title || !description || !projectId || !priority) {
      return reply
        .status(400)
        .send({ error: 'Title, description, projectId, and priority are required' });
    }

    const task = await container.createTask.execute({
      title,
      description,
      projectId,
      priority,
      metadata,
    });

    return reply.status(201).send(task);
  });

  // POST /tasks/:id/assign - Assign task to agent
  fastify.post<{
    Params: { id: string };
    Body: { agentId: string };
  }>('/tasks/:id/assign', async (request, reply) => {
    const { id } = request.params;
    const { agentId } = request.body;

    if (!agentId) {
      return reply.status(400).send({ error: 'agentId is required' });
    }

    try {
      const task = await container.assignTaskToAgent.execute({
        taskId: id,
        agentId,
      });
      return task;
    } catch (error) {
      return reply
        .status(400)
        .send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // POST /tasks/:id/execute - Execute task
  fastify.post<{ Params: { id: string } }>(
    '/tasks/:id/execute',
    async (request, reply) => {
      const { id } = request.params;

      try {
        const task = await container.executeTask.execute({ taskId: id });
        return task;
      } catch (error) {
        return reply
          .status(400)
          .send({ error: error instanceof Error ? error.message : String(error) });
      }
    },
  );
}
