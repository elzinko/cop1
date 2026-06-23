import { SprintSessionService } from '@cop1/sprint-core';
import { YamlSprintStatusAdapter } from '../../orchestrator/infrastructure/YamlSprintStatusAdapter.js';
import { DEFAULT_PORT } from '../domain/DaemonState.js';
import { checkAuth } from '../infrastructure/AuthChecker.js';
import { HttpServer } from '../infrastructure/HttpServer.js';
import { PidFileManager } from '../infrastructure/PidFileManager.js';

export interface DaemonOptions {
  port?: number;
  projectPath?: string;
}

export class DaemonService {
  private readonly httpServer: HttpServer;
  private readonly pidManager: PidFileManager;
  private readonly port: number;

  constructor(options: DaemonOptions = {}) {
    this.port = options.port ?? DEFAULT_PORT;
    const projectPath = options.projectPath ?? process.cwd();
    this.httpServer = new HttpServer();
    this.pidManager = new PidFileManager(projectPath);

    this.httpServer.setSprintStatusProvider(() => {
      const reader = new YamlSprintStatusAdapter(projectPath);
      const sessionService = new SprintSessionService(projectPath);

      const statuses = reader.getAllStatuses();
      const stories: Record<string, string> = {};
      for (const [id, status] of statuses) {
        stories[id] = status;
      }

      return { stories, session: sessionService.check() };
    });

    // Wire the auth-check probe (Story A): GET /api/auth/check runs a cheap,
    // single-turn SDK call inheriting the environment's Claude credentials.
    this.httpServer.setAuthChecker(() => checkAuth());
  }

  async start(): Promise<void> {
    await this.httpServer.start(this.port);
    this.pidManager.write(process.pid);
    this.registerShutdownHandlers();
  }

  async stop(): Promise<void> {
    await this.httpServer.stop();
    this.pidManager.delete();
  }

  private registerShutdownHandlers(): void {
    const shutdown = async () => {
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}
