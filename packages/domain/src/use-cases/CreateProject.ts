import { Project, ProjectStatus, type ProjectMetadata } from '../entities/Project.js';
import type { ProjectRepository } from '../ports/repositories/ProjectRepository.js';
import { randomUUID } from 'node:crypto';

/**
 * Use Case: Create a new project
 */

export interface CreateProjectInput {
  name: string;
  description: string;
  metadata?: ProjectMetadata;
}

export class CreateProject {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async execute(input: CreateProjectInput): Promise<Project> {
    const project = new Project(
      randomUUID(),
      input.name,
      input.description,
      ProjectStatus.ACTIVE,
      new Date(),
      new Date(),
      input.metadata ?? {},
    );

    await this.projectRepository.save(project);

    return project;
  }
}
