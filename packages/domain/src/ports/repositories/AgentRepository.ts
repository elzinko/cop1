import type { Agent, AgentStatus, AgentType } from '../../entities/Agent.js';

/**
 * Port (interface) for Agent repository
 */
export interface AgentRepository {
  /**
   * Save an agent (create or update)
   */
  save(agent: Agent): Promise<void>;

  /**
   * Find agent by ID
   */
  findById(id: string): Promise<Agent | null>;

  /**
   * Find all agents
   */
  findAll(): Promise<Agent[]>;

  /**
   * Find agents by status
   */
  findByStatus(status: AgentStatus): Promise<Agent[]>;

  /**
   * Find agents by type
   */
  findByType(type: AgentType): Promise<Agent[]>;

  /**
   * Find idle agents (available for work)
   */
  findIdleAgents(): Promise<Agent[]>;

  /**
   * Find agents using local LLM
   */
  findLocalLLMAgents(): Promise<Agent[]>;

  /**
   * Find agents using cloud LLM
   */
  findCloudLLMAgents(): Promise<Agent[]>;

  /**
   * Delete an agent
   */
  delete(id: string): Promise<void>;
}
