import {
  LLMCodeGenerator,
  LLMGateway,
  LLMReviewer,
  LLMRouter,
  OllamaAdapter,
} from '@cop1/llm-intelligence';
import { QualityGateService } from '@cop1/quality-intelligence';
import { EventBus } from '@cop1/shared-kernel';
import {
  BMADReader,
  CheckpointPhase,
  CheckpointService,
  DevAgent,
  PMAgentStep,
  QAAgentStep,
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
}

export interface SprintRunResult {
  storiesProcessed: number;
  storiesDone: number;
  storiesFailed: number;
  storiesSkipped: number;
  durationMs: number;
  dryRun: boolean;
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
    const start = Date.now();

    // Load config
    const configLoader = new ConfigLoader({ skipRamValidation: true });
    const config = configLoader.load(this.projectPath);

    // Initialize services
    const bmadReader = new BMADReader();
    const statusStore = new YamlStatusStore(this.projectPath);
    const tracker = new StoryStatusTracker(statusStore);
    const sessionService = new SprintSessionService(this.projectPath);
    const checkpointService = new CheckpointService(this.projectPath);
    const qualityGate = new QualityGateService();
    const engine = new WorkflowEngine(this.eventBus, qualityGate);

    // Read stories
    const allStories = bmadReader.listStories(this.projectPath);
    const eligibleStories = this.filterEligible(allStories, tracker, options.filter);

    this.eventBus.emit('sprint.starting', {
      totalStories: allStories.length,
      eligibleStories: eligibleStories.length,
      dryRun: options.dryRun ?? false,
    });

    if (options.dryRun) {
      return {
        storiesProcessed: 0,
        storiesDone: 0,
        storiesFailed: 0,
        storiesSkipped: eligibleStories.length,
        durationMs: Date.now() - start,
        dryRun: true,
      };
    }

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

    // Build workflow steps — use custom steps (for testing) or real agents
    const steps = this.customSteps ?? this.buildRealSteps(configLoader);

    let done = 0;
    let failed = 0;

    for (const story of eligibleStories) {
      if (!sessionService.isActive()) {
        this.eventBus.emit('sprint.expired', { storyId: story.id });
        break;
      }

      // Transition: backlog → ready → in-progress
      this.transitionToInProgress(tracker, story.id);

      // Save checkpoint
      checkpointService.save({
        storyId: story.id,
        agentName: 'workflow',
        stepIndex: 0,
        stepName: steps[0]?.name ?? 'unknown',
        timestamp: new Date().toISOString(),
        phase: CheckpointPhase.AGENT_STARTED,
      });

      const context = { storyId: story.id, projectPath: this.projectPath, config };

      let result: StepResult;
      if (resumeStoryId === story.id && checkpoint) {
        result = await engine.resume(context, steps, checkpoint);
        resumeStoryId = null;
      } else {
        result = await engine.run(context, steps);
      }

      if (result.status === 'ok') {
        // in-progress → review → done
        tracker.setStatus(story.id, StoryStatus.REVIEW);
        tracker.setStatus(story.id, StoryStatus.DONE);
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
    };

    this.eventBus.emit('sprint.completed', runResult);
    return runResult;
  }

  private buildRealSteps(configLoader: ConfigLoader): WorkflowStep[] {
    const ollama = new OllamaAdapter();
    const gateway = new LLMGateway(ollama).withRouter(new LLMRouter(configLoader));
    const codeGenerator = new LLMCodeGenerator(gateway);
    const reviewer = new LLMReviewer(gateway);

    return [
      new DevAgent(codeGenerator),
      new ReviewerAgent(reviewer),
      new QAAgentStep(), // stub — will be wired in a future story
      new PMAgentStep(), // stub — will be wired in a future story
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
