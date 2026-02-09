import type { TaskRepository } from '../ports/repositories/TaskRepository.js';
import type { AgentRepository } from '../ports/repositories/AgentRepository.js';
import type { Task } from '../entities/Task.js';

/**
 * Use Case: Assign a task to an agent
 * Business logic: Validates task can be assigned and agent can take it
 */

export interface AssignTaskToAgentInput {
  taskId: string;
  agentId: string;
}

export class AssignTaskToAgent {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly agentRepository: AgentRepository,
  ) {}

  async execute(input: AssignTaskToAgentInput): Promise<Task> {
    // Business validation: task must exist and be assignable
    const task = await this.taskRepository.findById(input.taskId);
    if (!task) {
      throw new Error(`Task ${input.taskId} not found`);
    }

    // Business validation: agent must exist and be available
    const agent = await this.agentRepository.findById(input.agentId);
    if (!agent) {
      throw new Error(`Agent ${input.agentId} not found`);
    }

    if (!agent.canTakeTask()) {
      throw new Error(
        `Agent ${input.agentId} cannot take task (status: ${agent.status})`,
      );
    }

    // Apply business rules (entities enforce their own rules)
    task.assignTo(input.agentId);
    agent.assignTask(input.taskId);

    // Persist both
    await Promise.all([
      this.taskRepository.save(task),
      this.agentRepository.save(agent),
    ]);

    return task;
  }
}
