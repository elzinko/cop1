/**
 * Project entity - Business representation of a project with tasks
 * PURE BUSINESS LOGIC - No infrastructure dependencies
 */

export enum ProjectStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export interface ProjectMetadata {
  repository?: string;
  branch?: string;
  technologies?: string[];
  [key: string]: unknown;
}

export class Project {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public status: ProjectStatus,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public metadata: ProjectMetadata,
  ) {}

  /**
   * Business rule: Tasks can only be added to active projects
   */
  canAddTasks(): boolean {
    return this.status === ProjectStatus.ACTIVE;
  }

  /**
   * Pause project
   */
  pause(): void {
    if (this.status !== ProjectStatus.ACTIVE) {
      throw new Error(`Project ${this.id} cannot be paused (status: ${this.status})`);
    }
    this.status = ProjectStatus.PAUSED;
    this.updatedAt = new Date();
  }

  /**
   * Resume project
   */
  resume(): void {
    if (this.status !== ProjectStatus.PAUSED) {
      throw new Error(`Project ${this.id} cannot be resumed (status: ${this.status})`);
    }
    this.status = ProjectStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Complete project
   */
  complete(): void {
    this.status = ProjectStatus.COMPLETED;
    this.updatedAt = new Date();
  }

  /**
   * Archive project
   */
  archive(): void {
    this.status = ProjectStatus.ARCHIVED;
    this.updatedAt = new Date();
  }
}
