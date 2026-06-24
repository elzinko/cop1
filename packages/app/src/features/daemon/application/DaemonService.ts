import { EventBus } from '@cop1/shared-kernel';
import { SprintSessionService } from '@cop1/sprint-core';
import { HttpOrchestratorAdapter } from '../../orchestrator/infrastructure/HttpOrchestratorAdapter.js';
import { YamlSprintStatusAdapter } from '../../orchestrator/infrastructure/YamlSprintStatusAdapter.js';
import { DEFAULT_PORT } from '../domain/DaemonState.js';
import { checkAuth } from '../infrastructure/AuthChecker.js';
import { HttpServer } from '../infrastructure/HttpServer.js';
import { PidFileManager } from '../infrastructure/PidFileManager.js';

export interface DaemonOptions {
  port?: number;
  projectPath?: string;
  /** Injectable for tests; defaults to a fresh in-process bus. */
  eventBus?: EventBus;
}

export class DaemonService {
  private readonly httpServer: HttpServer;
  private readonly pidManager: PidFileManager;
  private readonly port: number;
  private readonly eventBus: EventBus;

  constructor(options: DaemonOptions = {}) {
    this.port = options.port ?? DEFAULT_PORT;
    const projectPath = options.projectPath ?? process.cwd();
    this.httpServer = new HttpServer();
    this.pidManager = new PidFileManager(projectPath);

    // B1 (load-bearing): the daemon owns the EventBus and bridges it to SSE, so
    // a run's `orchestrator.*` / `session.*` events stream to `/events` for free.
    this.eventBus = options.eventBus ?? new EventBus();
    this.httpServer.setEventBus(this.eventBus);

    // B2: in-process single-run adapter, sinking tagged events onto the daemon bus.
    this.httpServer.setOrchestratorAdapter(new HttpOrchestratorAdapter(this.eventBus, projectPath));

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
