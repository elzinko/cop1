import type { FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { AgentType, type AgentCapabilities, type AgentLLMConfig } from '@cop1/domain';

/**
 * Agents routes
 */
export async function agentsRoutes(
  fastify: FastifyInstance,
  options: { container: Container },
) {
  const { container } = options;

  // GET /agents - List all agents
  fastify.get('/agents', async () => {
    const agents = await container.agentRepository.findAll();
    return agents;
  });

  // GET /agents/:id - Get agent by ID
  fastify.get<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const agent = await container.agentRepository.findById(request.params.id);
    if (!agent) {
      return reply.status(404).send({ error: 'Agent not found' });
    }
    return agent;
  });

  // POST /agents - Create a new agent
  fastify.post<{
    Body: {
      name: string;
      type: AgentType;
      capabilities: AgentCapabilities;
      llmConfig: AgentLLMConfig;
      rulesModules?: string[];
    };
  }>('/agents', async (request, reply) => {
    const { name, type, capabilities, llmConfig, rulesModules } = request.body;

    if (!name || !type || !capabilities || !llmConfig) {
      return reply
        .status(400)
        .send({ error: 'Name, type, capabilities, and llmConfig are required' });
    }

    const agent = await container.createAgent.execute({
      name,
      type,
      capabilities,
      llmConfig,
      rulesModules,
    });

    return reply.status(201).send(agent);
  });

  // GET /agents/idle - Get idle agents
  fastify.get('/agents/idle', async () => {
    const agents = await container.agentRepository.findIdleAgents();
    return agents;
  });

  // GET /agents/local - Get agents using local LLM
  fastify.get('/agents/local', async () => {
    const agents = await container.agentRepository.findLocalLLMAgents();
    return agents;
  });

  // GET /agents/cloud - Get agents using cloud LLM
  fastify.get('/agents/cloud', async () => {
    const agents = await container.agentRepository.findCloudLLMAgents();
    return agents;
  });
}
