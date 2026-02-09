import {
  Agent,
  AgentStatus,
  type AgentType,
  type AgentCapabilities,
  type AgentLLMConfig,
} from '../entities/Agent.js';
import type { AgentRepository } from '../ports/repositories/AgentRepository.js';
import { randomUUID } from 'node:crypto';

/**
 * Use Case: Create a new agent
 */

export interface CreateAgentInput {
  name: string;
  type: AgentType;
  capabilities: AgentCapabilities;
  llmConfig: AgentLLMConfig;
  rulesModules?: string[];
}

export class CreateAgent {
  constructor(private readonly agentRepository: AgentRepository) {}

  async execute(input: CreateAgentInput): Promise<Agent> {
    const agent = new Agent(
      randomUUID(),
      input.name,
      input.type,
      AgentStatus.IDLE,
      input.capabilities,
      input.llmConfig,
      input.rulesModules ?? [],
      null, // No current task
      new Date(),
      new Date(),
    );

    await this.agentRepository.save(agent);

    return agent;
  }
}
