import type { Project, ProjectStatus } from '../../entities/Project.js';

/**
 * Port (interface) for Project repository
 */
export interface ProjectRepository {
  /**
   * Save a project (create or update)
   */
  save(project: Project): Promise<void>;

  /**
   * Find project by ID
   */
  findById(id: string): Promise<Project | null>;

  /**
   * Find all projects
   */
  findAll(): Promise<Project[]>;

  /**
   * Find projects by status
   */
  findByStatus(status: ProjectStatus): Promise<Project[]>;

  /**
   * Find active projects
   */
  findActiveProjects(): Promise<Project[]>;

  /**
   * Delete a project
   */
  delete(id: string): Promise<void>;
}
