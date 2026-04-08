import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LoggerBridge, StructuredLogger } from '@cop1/observability';
import { QualityGateService } from '@cop1/quality-intelligence';
import { EventBus } from '@cop1/shared-kernel';
import {
  BMADReader,
  BmadStatusReader,
  CheckpointPhase,
  CheckpointService,
  SprintSessionService,
  type SprintStatusReaderPort,
  type StepResult,
  type StoryMetadata,
  WorkflowEngine,
  type WorkflowStep,
} from '@cop1/sprint-core';
import { ConfigLoader } from '../features/config/application/ConfigLoader.js';
import type { PipelineStepFactory } from './PipelineStepFactory.js';

export interface SprintRunnerDeps {
  projectPath: string;
  eventBus?: EventBus;
  steps?: WorkflowStep[];
  stepFactory?: PipelineStepFactory;
  statusReader?: SprintStatusReaderPort;
}

export interface SprintRunOptions {
  filter?: string;
  dryRun?: boolean;
  simulate?: boolean;
}

export interface SprintRunResult {
  storiesProcessed: number;
  storiesDone: number;
  storiesFailed: number;
  storiesSkipped: number;
  durationMs: number;
  dryRun: boolean;
  simulate: boolean;
  worktreePath?: string;
}

export class SprintRunner {
  readonly eventBus: EventBus;
  private readonly projectPath: string;
  private readonly customSteps?: WorkflowStep[];
  private readonly stepFactory?: PipelineStepFactory;
  private readonly statusReader: SprintStatusReaderPort;

  constructor(deps: SprintRunnerDeps) {
    this.projectPath = deps.projectPath;
    this.eventBus = deps.eventBus ?? new EventBus();
    this.customSteps = deps.steps;
    this.stepFactory = deps.stepFactory;
    this.statusReader = deps.statusReader ?? new BmadStatusReader(deps.projectPath);
  }

  async run(options: SprintRunOptions = {}): Promise<SprintRunResult> {
    if (options.dryRun && options.simulate) {
      throw new Error('--dry-run and --simulate are mutually exclusive');
    }

    const start = Date.now();

    // Load config from the real project (always)
    const configLoader = new ConfigLoader({ skipRamValidation: true });
    const config = configLoader.load(this.projectPath);

    // Wire structured logging
    const logger = new StructuredLogger(this.projectPath);
    const loggerBridge = new LoggerBridge(this.eventBus, logger);
    loggerBridge.start();

    // Read stories from the real project (always)
    const bmadReader = new BMADReader();
    const allStories = bmadReader.listStories(this.projectPath);

    // Filter eligible stories using read-only status reader (single file read)
    const allStatuses = this.statusReader.getAllStatuses();
    const eligibleStories = this.filterEligibleFromMap(allStories, allStatuses, options.filter);

    this.eventBus.emit('sprint.starting', {
      totalStories: allStories.length,
      eligibleStories: eligibleStories.length,
      dryRun: options.dryRun ?? false,
      simulate: options.simulate ?? false,
    });

    if (options.dryRun) {
      return {
        storiesProcessed: 0,
        storiesDone: 0,
        storiesFailed: 0,
        storiesSkipped: eligibleStories.length,
        durationMs: Date.now() - start,
        dryRun: true,
        simulate: false,
      };
    }

    // Determine execution path: simulate (worktree) or normal
    const executionPath = options.simulate ? this.createSimulateWorktree() : this.projectPath;

    // Initialize services in execution path
    const sessionService = new SprintSessionService(executionPath);
    const checkpointService = new CheckpointService(executionPath);
    const qualityGate = new QualityGateService();
    const engine = new WorkflowEngine(this.eventBus, qualityGate);

    // Start sprint session
    const durationMinutes = config.sprint.default_duration_hours * 60;
    sessionService.start(durationMinutes);

    // Check for existing checkpoint
    const checkpoint = checkpointService.read();
    let resumeStoryId: string | null = null;
    if (checkpoint) {
      resumeStoryId = checkpoint.storyId;
      this.eventBus.emit('sprint.resuming', { checkpoint });
    }

    // Build workflow steps
    if (!this.customSteps && !this.stepFactory) {
      throw new Error('SprintRunner requires either steps or stepFactory');
    }
    const steps = this.customSteps ?? this.stepFactory!.build(config, configLoader);

    let done = 0;
    let failed = 0;

    for (const story of eligibleStories) {
      if (!sessionService.isActive()) {
        this.eventBus.emit('sprint.expired', { storyId: story.id });
        break;
      }

      // Save checkpoint
      checkpointService.save({
        storyId: story.id,
        agentName: 'workflow',
        stepIndex: 0,
        stepName: steps[0]?.name ?? 'unknown',
        timestamp: new Date().toISOString(),
        phase: CheckpointPhase.AGENT_STARTED,
      });

      // Read story content for prompt enrichment
      let storyContent: string | undefined;
      try {
        storyContent = readFileSync(story.filePath, 'utf-8');
      } catch {
        // Story file may not be accessible from worktree — fall back to ID only
      }

      const context = {
        storyId: story.id,
        projectPath: executionPath,
        config,
        storyContent,
        preserveWorktree: options.simulate,
      };

      let result: StepResult;
      if (resumeStoryId === story.id && checkpoint) {
        result = await engine.resume(context, steps, checkpoint);
        resumeStoryId = null;
      } else {
        result = await engine.run(context, steps);
      }

      if (result.status === 'ok') {
        this.eventBus.emit('story.completed', { storyId: story.id });
        done++;
      } else {
        failed++;
      }

      checkpointService.clear();
    }

    sessionService.stop();

    const runResult: SprintRunResult = {
      storiesProcessed: done + failed,
      storiesDone: done,
      storiesFailed: failed,
      storiesSkipped: eligibleStories.length - done - failed,
      durationMs: Date.now() - start,
      dryRun: false,
      simulate: options.simulate ?? false,
      worktreePath: options.simulate ? executionPath : undefined,
    };

    this.eventBus.emit('sprint.completed', runResult);
    return runResult;
  }

  listEligible(filter?: string): Array<{ id: string; title: string; status: string }> {
    const bmadReader = new BMADReader();
    const allStories = bmadReader.listStories(this.projectPath);
    const allStatuses = this.statusReader.getAllStatuses();
    const eligible = this.filterEligibleFromMap(allStories, allStatuses, filter);
    return eligible.map((s) => {
      const status = allStatuses.get(s.id);
      return { id: s.id, title: s.title, status: status ?? 'new' };
    });
  }

  private createSimulateWorktree(): string {
    const timestamp = Date.now();
    const worktreeName = `simulate-${timestamp}`;
    const worktreePath = join(this.projectPath, 'agent', worktreeName);

    this.eventBus.emit('simulate.worktree.creating', { path: worktreePath });

    execSync(`git worktree add "${worktreePath}" HEAD`, {
      cwd: this.projectPath,
      stdio: 'pipe',
    });

    // Copy .cop1 state into the worktree
    const cop1Dir = join(this.projectPath, '.cop1');
    const targetCop1Dir = join(worktreePath, '.cop1');
    if (existsSync(cop1Dir)) {
      mkdirSync(targetCop1Dir, { recursive: true });
      cpSync(cop1Dir, targetCop1Dir, { recursive: true });
    }

    this.eventBus.emit('simulate.worktree.created', { path: worktreePath });

    return worktreePath;
  }

  private filterEligibleFromMap(
    stories: StoryMetadata[],
    allStatuses: Map<string, string>,
    filter?: string,
  ): StoryMetadata[] {
    let eligible = stories.filter((s) => {
      const status = allStatuses.get(s.id) ?? null;
      if (!status) return true; // No status entry = new story
      return status === 'backlog' || status === 'ready' || status === 'ready-for-dev';
    });

    if (filter) {
      const pattern = filter.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`, 'i');
      eligible = eligible.filter((s) => regex.test(s.id));
    }

    return eligible;
  }
}
