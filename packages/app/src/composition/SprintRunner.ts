import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LLMCodeGenerator,
  LLMGateway,
  LLMReviewer,
  LLMRouter,
  OllamaAdapter,
  TokensPerSecMonitor,
} from '@cop1/llm-intelligence';
import { LoggerBridge, StructuredLogger } from '@cop1/observability';
import { QualityGateService } from '@cop1/quality-intelligence';
import { EventBus } from '@cop1/shared-kernel';
import {
  BMADReader,
  CheckpointPhase,
  CheckpointService,
  DevAgent,
  PMAgentWorkflowStep,
  QAAgent,
  ReviewerAgent,
  SprintSessionService,
  type StepResult,
  type StoryMetadata,
  StoryStatus,
  StoryStatusTracker,
  WorkflowEngine,
  type WorkflowStep,
  YamlStatusStore,
} from '@cop1/sprint-core';
import { ConfigLoader } from '../features/config/application/ConfigLoader.js';

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

  constructor(projectPath: string, eventBus?: EventBus, steps?: WorkflowStep[]) {
    this.projectPath = projectPath;
    this.eventBus = eventBus ?? new EventBus();
    this.customSteps = steps;
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

    // Tracker from the real project (for filtering eligibility)
    const statusStore = new YamlStatusStore(this.projectPath);
    const tracker = new StoryStatusTracker(statusStore);
    const eligibleStories = this.filterEligible(allStories, tracker, options.filter);

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
    const execStatusStore = new YamlStatusStore(executionPath);
    const execTracker = new StoryStatusTracker(execStatusStore);
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
    const steps = this.customSteps ?? this.buildRealSteps(configLoader);

    let done = 0;
    let failed = 0;

    for (const story of eligibleStories) {
      if (!sessionService.isActive()) {
        this.eventBus.emit('sprint.expired', { storyId: story.id });
        break;
      }

      // Transition: backlog → ready → in-progress
      this.transitionToInProgress(execTracker, story.id);

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
        // in-progress → review → done
        execTracker.setStatus(story.id, StoryStatus.REVIEW);
        execTracker.setStatus(story.id, StoryStatus.DONE);
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

  private buildRealSteps(configLoader: ConfigLoader): WorkflowStep[] {
    const ollama = new OllamaAdapter();
    const gateway = new LLMGateway(ollama, this.eventBus).withRouter(new LLMRouter(configLoader));
    const codeGenerator = new LLMCodeGenerator(gateway);
    const reviewer = new LLMReviewer(gateway);

    // Wire tokens-per-second monitor
    const tpsMonitor = new TokensPerSecMonitor();
    this.eventBus.on('llm.call.completed', (payload: unknown) => {
      const p = payload as { agentType: string; tokenCount: number; durationMs: number };
      tpsMonitor.record(p.agentType, p.tokenCount, p.durationMs);
    });

    return [
      new DevAgent(codeGenerator),
      new ReviewerAgent(reviewer),
      new QAAgent(),
      new PMAgentWorkflowStep(),
    ];
  }

  private filterEligible(
    stories: StoryMetadata[],
    tracker: StoryStatusTracker,
    filter?: string,
  ): StoryMetadata[] {
    let eligible = stories.filter((s) => {
      const entry = tracker.getStatus(s.id);
      if (!entry) return true; // No tracker entry = new story
      return entry.status === StoryStatus.BACKLOG || entry.status === StoryStatus.READY;
    });

    if (filter) {
      const pattern = filter.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`, 'i');
      eligible = eligible.filter((s) => regex.test(s.id));
    }

    return eligible;
  }

  private transitionToInProgress(tracker: StoryStatusTracker, storyId: string): void {
    const entry = tracker.getStatus(storyId);
    const currentStatus = entry?.status ?? StoryStatus.BACKLOG;

    if (currentStatus === StoryStatus.BACKLOG) {
      tracker.setStatus(storyId, StoryStatus.READY);
      tracker.setStatus(storyId, StoryStatus.IN_PROGRESS);
    } else if (currentStatus === StoryStatus.READY) {
      tracker.setStatus(storyId, StoryStatus.IN_PROGRESS);
    }
  }
}
