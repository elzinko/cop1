/**
 * Task entity - Business representation of work to be done
 * PURE BUSINESS LOGIC - No infrastructure dependencies
 */

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  BLOCKED = 'blocked',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface TaskMetadata {
  estimatedDuration?: number; // in minutes
  tags?: string[];
  context?: string; // Additional context for the task
  [key: string]: unknown;
}

export class Task {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string,
    public readonly projectId: string,
    public status: TaskStatus,
    public priority: TaskPriority,
    public assignedAgentId: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public completedAt: Date | null,
    public result: string | null,
    public error: string | null,
    public metadata: TaskMetadata,
  ) {}

  /**
   * Business rule: A task can only be assigned if it's pending
   */
  canBeAssigned(): boolean {
    return this.status === TaskStatus.PENDING;
  }

  /**
   * Business rule: A task can be started if assigned and pending
   */
  canBeStarted(): boolean {
    return this.status === TaskStatus.PENDING && this.assignedAgentId !== null;
  }

  /**
   * Business rule: A task can be completed if in progress
   */
  canBeCompleted(): boolean {
    return this.status === TaskStatus.IN_PROGRESS;
  }

  /**
   * Assign task to an agent
   */
  assignTo(agentId: string): void {
    if (!this.canBeAssigned()) {
      throw new Error(`Task ${this.id} cannot be assigned (status: ${this.status})`);
    }
    this.assignedAgentId = agentId;
    this.updatedAt = new Date();
  }

  /**
   * Start task execution
   */
  start(): void {
    if (!this.canBeStarted()) {
      throw new Error(`Task ${this.id} cannot be started`);
    }
    this.status = TaskStatus.IN_PROGRESS;
    this.updatedAt = new Date();
  }

  /**
   * Complete task with result
   */
  complete(result: string): void {
    if (!this.canBeCompleted()) {
      throw new Error(`Task ${this.id} cannot be completed (status: ${this.status})`);
    }
    this.status = TaskStatus.COMPLETED;
    this.result = result;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Fail task with error
   */
  fail(error: string): void {
    this.status = TaskStatus.FAILED;
    this.error = error;
    this.updatedAt = new Date();
  }

  /**
   * Block task (e.g., waiting for another task)
   */
  block(reason: string): void {
    this.status = TaskStatus.BLOCKED;
    this.error = reason;
    this.updatedAt = new Date();
  }

  /**
   * Unblock task
   */
  unblock(): void {
    if (this.status !== TaskStatus.BLOCKED) {
      throw new Error(`Task ${this.id} is not blocked`);
    }
    this.status = TaskStatus.PENDING;
    this.error = null;
    this.updatedAt = new Date();
  }
}
