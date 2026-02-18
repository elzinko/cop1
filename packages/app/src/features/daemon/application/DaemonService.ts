import { SprintSessionService, StoryStatusTracker, YamlStatusStore } from '@cop1/sprint-core';
import { DEFAULT_PORT } from '../domain/DaemonState.js';
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
      const store = new YamlStatusStore(projectPath);
      const tracker = new StoryStatusTracker(store);
      const sessionService = new SprintSessionService(projectPath);

      const statuses = tracker.getAllStatuses();
      const stories: Record<string, string> = {};
      for (const [id, entry] of statuses) {
        stories[id] = entry.status;
      }

      return { stories, session: sessionService.check() };
    });
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
