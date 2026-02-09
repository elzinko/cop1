import { Task, TaskStatus, TaskPriority, type TaskMetadata } from '../entities/Task.js';
import type { TaskRepository } from '../ports/repositories/TaskRepository.js';
import type { ProjectRepository } from '../ports/repositories/ProjectRepository.js';
import { randomUUID } from 'node:crypto';

/**
 * Use Case: Create a new task
 * Business logic: Validates project exists and can accept tasks
 */

export interface CreateTaskInput {
  title: string;
  description: string;
  projectId: string;
  priority: TaskPriority;
  metadata?: TaskMetadata;
}

export class CreateTask {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async execute(input: CreateTaskInput): Promise<Task> {
    // Business validation: project must exist and be active
    const project = await this.projectRepository.findById(input.projectId);
    if (!project) {
      throw new Error(`Project ${input.projectId} not found`);
    }

    if (!project.canAddTasks()) {
      throw new Error(
        `Cannot add tasks to project ${input.projectId} (status: ${project.status})`,
      );
    }

    // Create task entity
    const task = new Task(
      randomUUID(),
      input.title,
      input.description,
      input.projectId,
      TaskStatus.PENDING,
      input.priority,
      null, // No agent assigned yet
      new Date(),
      new Date(),
      null, // Not completed
      null, // No result
      null, // No error
      input.metadata ?? {},
    );

    // Persist
    await this.taskRepository.save(task);

    return task;
  }
}
