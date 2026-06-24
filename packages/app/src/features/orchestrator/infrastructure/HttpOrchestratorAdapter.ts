import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type EventBus, TaggingEventBus } from '@cop1/shared-kernel';
import {
  type OrchestratorRunHandle,
  buildOrchestratorRun,
} from '../../../cli/commands/orchestrator.js';
import type { BMADCommandRunner, OrchestratorMode } from '../application/OrchestratorService.js';
import { SupervisorPlaybookLoader } from '../application/SupervisorPlaybookLoader.js';

/** Thrown when a second run is requested while one is already active (→ HTTP 409). */
export class RunAlreadyActiveError extends Error {
  constructor() {
    super('A run is already active');
    this.name = 'RunAlreadyActiveError';
  }
}

export interface RunCaps {
  maxTokens?: number;
  deadlineMin?: number;
  maxUsdPerSession?: number;
}

export interface StartRunOptions {
  epic: string;
  mode: OrchestratorMode;
  caps?: RunCaps;
}

/** Arguments handed to the run factory — playbook loading lives inside the factory. */
export interface RunFactoryOptions {
  epic: string;
  mode: OrchestratorMode;
  projectRoot: string;
  /** The run emits on THIS bus (a TaggingEventBus tagging events with the runId). */
  eventBus: EventBus;
  caps?: RunCaps;
}

/** Injectable run factory (fake in tests). Default loads the playbook + buildOrchestratorRun. */
export type RunFactory = (opts: RunFactoryOptions) => Promise<OrchestratorRunHandle>;

export interface HttpOrchestratorAdapterDeps {
  runFactory?: RunFactory;
  /** Override the playbook loader used by the default run factory (tests). */
  loadPlaybook?: (
    projectRoot: string,
  ) => Promise<Awaited<ReturnType<SupervisorPlaybookLoader['load']>>>;
  /** Explicit runner override forwarded to the default run factory. */
  runner?: BMADCommandRunner;
}

/**
 * In-process, single-run orchestrator adapter for the daemon.
 *
 * `startRun` is a synchronous guard+return: it reserves the single run slot,
 * fires the run in the background (so the HTTP handler returns `{ runId }`
 * immediately), and tags every event with the generated `runId` via a
 * `TaggingEventBus` whose sink is the daemon's SSE-bridged bus.
 *
 * STOP writes `.cop1/abort`; the run's RunBudget abort predicate picks it up and
 * stops cleanly. The active flag always resets in `execute`'s `finally`.
 */
export class HttpOrchestratorAdapter {
  private activeRunId: string | null = null;
  private readonly runFactory: RunFactory;

  constructor(
    private readonly sink: EventBus,
    private readonly projectRoot: string,
    deps: HttpOrchestratorAdapterDeps = {},
  ) {
    const loadPlaybook =
      deps.loadPlaybook ??
      ((root: string) =>
        new SupervisorPlaybookLoader({ projectRoot: root }).load(
          join(root, 'supervisor-playbook.md'),
        ));
    this.runFactory =
      deps.runFactory ??
      (async (opts: RunFactoryOptions) => {
        const playbook = await loadPlaybook(opts.projectRoot);
        return buildOrchestratorRun({
          playbook,
          epic: opts.epic,
          mode: opts.mode,
          projectRoot: opts.projectRoot,
          eventBus: opts.eventBus,
          ...(deps.runner ? { runner: deps.runner } : {}),
          ...(opts.caps ? { caps: opts.caps } : {}),
        });
      });
  }

  get isActive(): boolean {
    return this.activeRunId !== null;
  }

  /** Synchronous guard+return. Throws RunAlreadyActiveError if a run is active. */
  startRun(opts: StartRunOptions): { runId: string } {
    if (this.activeRunId !== null) {
      throw new RunAlreadyActiveError();
    }
    const runId = randomUUID();
    this.activeRunId = runId;
    void this.execute(runId, opts);
    return { runId };
  }

  private async execute(runId: string, opts: StartRunOptions): Promise<void> {
    const bus = new TaggingEventBus(this.sink, runId);
    try {
      // AC-B6: purge a stale abort file BEFORE building/running, so a leftover
      // `.cop1/abort` from a previous run cannot immediately kill this one.
      await rm(join(this.projectRoot, '.cop1', 'abort'), { force: true });

      const handle = await this.runFactory({
        epic: opts.epic,
        mode: opts.mode,
        projectRoot: this.projectRoot,
        eventBus: bus,
        ...(opts.caps ? { caps: opts.caps } : {}),
      });
      await handle.run();
    } catch (err) {
      bus.emit('orchestrator.run.failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.activeRunId = null;
    }
  }

  /** STOP: write `.cop1/abort`; the active run's budget kill-switch picks it up. */
  async stop(): Promise<void> {
    const abortDir = join(this.projectRoot, '.cop1');
    await mkdir(abortDir, { recursive: true });
    await writeFile(join(abortDir, 'abort'), '', 'utf-8');
  }
}
