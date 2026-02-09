/**
 * Dependency Injection Container
 * Wires together domain, infrastructure, and application layers
 * This is where hexagonal architecture comes together!
 */

import { initDatabase, getDatabase } from '@cop1/infrastructure';
import {
  SQLiteTaskRepository,
  SQLiteAgentRepository,
  SQLiteProjectRepository,
  RulesProviderAdapter,
  LLMProviderAdapter,
} from '@cop1/infrastructure';
import {
  CreateTask,
  CreateProject,
  CreateAgent,
  AssignTaskToAgent,
  ExecuteTask,
} from '@cop1/domain';

/**
 * Application Container
 * Contains all dependencies (repositories, use-cases, etc.)
 */
export class Container {
  // Repositories
  public readonly taskRepository: SQLiteTaskRepository;
  public readonly agentRepository: SQLiteAgentRepository;
  public readonly projectRepository: SQLiteProjectRepository;

  // Providers
  public readonly rulesProvider: RulesProviderAdapter;
  public readonly llmProvider: LLMProviderAdapter;

  // Use Cases
  public readonly createTask: CreateTask;
  public readonly createProject: CreateProject;
  public readonly createAgent: CreateAgent;
  public readonly assignTaskToAgent: AssignTaskToAgent;
  public readonly executeTask: ExecuteTask;

  constructor(dbPath: string) {
    // Initialize database
    initDatabase({ filename: dbPath });
    const db = getDatabase();

    // Initialize repositories (infrastructure adapters)
    this.taskRepository = new SQLiteTaskRepository(db);
    this.agentRepository = new SQLiteAgentRepository(db);
    this.projectRepository = new SQLiteProjectRepository(db);

    // Initialize providers (infrastructure adapters)
    this.rulesProvider = new RulesProviderAdapter();
    this.llmProvider = new LLMProviderAdapter();

    // Initialize use cases (domain orchestrators)
    // This is where we inject dependencies (Dependency Inversion Principle)
    this.createTask = new CreateTask(this.taskRepository, this.projectRepository);
    this.createProject = new CreateProject(this.projectRepository);
    this.createAgent = new CreateAgent(this.agentRepository);
    this.assignTaskToAgent = new AssignTaskToAgent(
      this.taskRepository,
      this.agentRepository,
    );
    this.executeTask = new ExecuteTask(
      this.taskRepository,
      this.agentRepository,
      this.llmProvider,
      this.rulesProvider,
    );
  }
}
