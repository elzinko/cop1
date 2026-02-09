/**
 * Agent entity - Business representation of an autonomous agent
 * PURE BUSINESS LOGIC - No infrastructure dependencies
 */

export enum AgentStatus {
  IDLE = 'idle',
  WORKING = 'working',
  OFFLINE = 'offline',
}

export enum AgentType {
  CODE_REVIEWER = 'code_reviewer',
  QA_TESTER = 'qa_tester',
  ARCHITECT = 'architect',
  DEVELOPER = 'developer',
  PROJECT_MANAGER = 'project_manager',
  DOCUMENTATION = 'documentation',
}

/**
 * Agent configuration for LLM provider
 * - Supports local (LMStudio, Ollama) or cloud (Claude, OpenAI)
 * - Hybrid mode: different agents can use different providers
 */
export interface AgentLLMConfig {
  provider: 'local' | 'cloud';
  modelName: string; // e.g., "claude-sonnet-4.5", "llama-3", "gpt-4"
  endpoint?: string; // For local LLMs
  apiKey?: string; // For cloud LLMs
  temperature?: number;
  maxTokens?: number;
}

export interface AgentCapabilities {
  canReviewCode: boolean;
  canWriteCode: boolean;
  canRunTests: boolean;
  canManageTasks: boolean;
  canAnalyzeArchitecture: boolean;
}

export class Agent {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: AgentType,
    public status: AgentStatus,
    public readonly capabilities: AgentCapabilities,
    public readonly llmConfig: AgentLLMConfig,
    public rulesModules: string[], // List of rules modules (e.g., ['clean-code', 'typescript-2026'])
    public currentTaskId: string | null,
    public readonly createdAt: Date,
    public lastActiveAt: Date,
  ) {}

  /**
   * Business rule: Agent can take a task if idle
   */
  canTakeTask(): boolean {
    return this.status === AgentStatus.IDLE && this.currentTaskId === null;
  }

  /**
   * Business rule: Agent can complete task if working on it
   */
  canCompleteTask(): boolean {
    return this.status === AgentStatus.WORKING && this.currentTaskId !== null;
  }

  /**
   * Assign task to agent
   */
  assignTask(taskId: string): void {
    if (!this.canTakeTask()) {
      throw new Error(`Agent ${this.id} cannot take task (status: ${this.status})`);
    }
    this.currentTaskId = taskId;
    this.status = AgentStatus.WORKING;
    this.lastActiveAt = new Date();
  }

  /**
   * Complete current task
   */
  completeTask(): void {
    if (!this.canCompleteTask()) {
      throw new Error(`Agent ${this.id} is not working on a task`);
    }
    this.currentTaskId = null;
    this.status = AgentStatus.IDLE;
    this.lastActiveAt = new Date();
  }

  /**
   * Go offline
   */
  goOffline(): void {
    this.status = AgentStatus.OFFLINE;
    this.lastActiveAt = new Date();
  }

  /**
   * Go back online
   */
  goOnline(): void {
    this.status = AgentStatus.IDLE;
    this.lastActiveAt = new Date();
  }

  /**
   * Check if agent uses local LLM
   */
  isUsingLocalLLM(): boolean {
    return this.llmConfig.provider === 'local';
  }

  /**
   * Check if agent uses cloud LLM
   */
  isUsingCloudLLM(): boolean {
    return this.llmConfig.provider === 'cloud';
  }
}
