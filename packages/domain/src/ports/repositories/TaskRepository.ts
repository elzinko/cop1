import type { Task, TaskStatus, TaskPriority } from '../../entities/Task.js';

/**
 * Port (interface) for Task repository
 * The domain defines WHAT it needs, not HOW it's implemented
 * Infrastructure will provide the adapter (SQLite, PostgreSQL, etc.)
 */
export interface TaskRepository {
  /**
   * Save a task (create or update)
   */
  save(task: Task): Promise<void>;

  /**
   * Find task by ID
   */
  findById(id: string): Promise<Task | null>;

  /**
   * Find all tasks for a project
   */
  findByProjectId(projectId: string): Promise<Task[]>;

  /**
   * Find tasks by status
   */
  findByStatus(status: TaskStatus): Promise<Task[]>;

  /**
   * Find tasks assigned to an agent
   */
  findByAgentId(agentId: string): Promise<Task[]>;

  /**
   * Find pending tasks (available for assignment)
   */
  findPendingTasks(projectId?: string): Promise<Task[]>;

  /**
   * Find tasks by priority
   */
  findByPriority(priority: TaskPriority, projectId?: string): Promise<Task[]>;

  /**
   * Delete a task
   */
  delete(id: string): Promise<void>;

  /**
   * Count tasks by status for a project
   */
  countByStatus(projectId: string, status: TaskStatus): Promise<number>;
}
