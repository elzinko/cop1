import type { TaskRepository } from '../ports/repositories/TaskRepository.js';
import type { AgentRepository } from '../ports/repositories/AgentRepository.js';
import type { LLMProvider, LLMRequest } from '../ports/LLMProvider.js';
import type { RulesProvider } from '../ports/RulesProvider.js';
import type { Task } from '../entities/Task.js';

/**
 * Use Case: Execute a task using an agent
 * Business logic: Agent executes task using LLM with its rules
 */

export interface ExecuteTaskInput {
  taskId: string;
}

export class ExecuteTask {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly agentRepository: AgentRepository,
    private readonly llmProvider: LLMProvider,
    private readonly rulesProvider: RulesProvider,
  ) {}

  async execute(input: ExecuteTaskInput): Promise<Task> {
    // Get task
    const task = await this.taskRepository.findById(input.taskId);
    if (!task) {
      throw new Error(`Task ${input.taskId} not found`);
    }

    // Get assigned agent
    if (!task.assignedAgentId) {
      throw new Error(`Task ${input.taskId} has no assigned agent`);
    }

    const agent = await this.agentRepository.findById(task.assignedAgentId);
    if (!agent) {
      throw new Error(`Agent ${task.assignedAgentId} not found`);
    }

    try {
      // Start task
      task.start();
      await this.taskRepository.save(task);

      // Load agent rules
      const rulesText = await this.rulesProvider.formatRulesForLLM(agent.rulesModules);

      // Build LLM request with rules in system prompt
      const llmRequest: LLMRequest = {
        messages: [
          {
            role: 'system',
            content: `You are an AI agent of type ${agent.type}.

Your behavior rules:
${rulesText}

Follow these rules when executing tasks.`,
          },
          {
            role: 'user',
            content: `Task: ${task.title}

Description: ${task.description}

Execute this task and provide the result.`,
          },
        ],
        temperature: agent.llmConfig.temperature,
        maxTokens: agent.llmConfig.maxTokens,
      };

      // Execute with LLM
      const response = await this.llmProvider.execute(agent.llmConfig, llmRequest);

      // Complete task with result
      task.complete(response.content);
      agent.completeTask();

      // Persist
      await Promise.all([
        this.taskRepository.save(task),
        this.agentRepository.save(agent),
      ]);

      return task;
    } catch (error) {
      // Fail task
      const errorMessage = error instanceof Error ? error.message : String(error);
      task.fail(errorMessage);
      await this.taskRepository.save(task);
      throw error;
    }
  }
}
