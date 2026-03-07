import { type ChildProcess, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import {
  BMADDevStoryStep,
  BMADQAStep,
  BMADReviewStep,
  type BMADCommandPort,
  type BMADCommandResult,
  BMADRetryExhaustedError,
  BudgetExhaustedError,
  ClaudeCliAdapter,
  RetryPolicy,
  type ProcessSpawner,
  type WorkflowStep,
  YamlStatusStore,
} from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PipelineStepFactory } from '../composition/PipelineStepFactory.js';
import { SprintRunner } from '../composition/SprintRunner.js';
import type { BudgetChecker } from '@cop1/sprint-core';

// ── Fixtures ──────────────────────────────────────────────────────────

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');
const FAKE_CLAUDE_PATH = join(FIXTURES_DIR, 'fake-claude.mjs');

const SIMPLE_STORY = readFileSync(join(FIXTURES_DIR, 'test-story.md'), 'utf-8');

function createStubSpawner(): ProcessSpawner {
  return (_cmd: string, args: string[], opts: { cwd: string; stdio: ['pipe', 'pipe', 'pipe'] }): ChildProcess => {
    return spawn('node', [FAKE_CLAUDE_PATH, ...args], opts);
  };
}

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'cop1-integ-'));
}

function createTempProject(storyContent?: string): string {
  const dir = createTempDir();
  mkdirSync(join(dir, '.cop1'), { recursive: true });

  // Write cop1.config.yaml
  cpSync(join(FIXTURES_DIR, 'cop1.config.yaml'), join(dir, 'cop1.config.yaml'));

  // Create story file
  const storiesDir = join(dir, '_bmad-output', 'planning-artifacts', 'stories', 'sprint-0');
  mkdirSync(storiesDir, { recursive: true });
  writeFileSync(join(storiesDir, 'E1-S1.md'), storyContent ?? SIMPLE_STORY);

  return dir;
}

function createWorkflowContext(projectPath: string, storyContent?: string) {
  return {
    storyId: 'E1-S1',
    projectPath,
    config: {
      project: { name: 'test', path: '.' },
      daemon: { port: 4242 },
      sprint: { default_duration_hours: 1 },
      resources: {
        ram_budget_night_gb: 8,
        ram_budget_day_gb: 8,
        suspension_threshold_percent: 75,
        polling_interval_ms: 1000,
      },
      llm_routing: {},
      llm_fallback: {},
      git: { auto_merge: false },
      workflow: { useBMAD: true },
      blocage_rules: {},
      schedule: { auto_start: [] },
      budget: {
        sprint_max_tokens: 1_000_000,
        alert_thresholds: [50, 80, 95],
        auto_pause: true,
      },
    },
    storyContent: storyContent ?? SIMPLE_STORY,
  };
}

// ── Adapter-Level Tests ───────────────────────────────────────────────

describe('ClaudeCliAdapter + fake-claude integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should execute successfully and parse token usage from JSON output', async () => {
    const eventBus = new EventBus();
    const events: Array<{ event: string; payload: unknown }> = [];
    eventBus.on('llm.call.started', (p: unknown) => events.push({ event: 'llm.call.started', payload: p }));
    eventBus.on('llm.call.completed', (p: unknown) => events.push({ event: 'llm.call.completed', payload: p }));

    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 10_000 }, createStubSpawner());
    const result = await adapter.execute('/bmad-bmm-dev-story', { projectPath: tmpDir, story: '# Test' });

    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.tokensUsed).toBe(1500); // 1000 input + 500 output
    expect(JSON.parse(result.output)).toHaveProperty('result');

    // Verify events
    expect(events).toHaveLength(2);
    expect(events[0]!.event).toBe('llm.call.started');
    expect(events[1]!.event).toBe('llm.call.completed');
    const completed = events[1]!.payload as { tokenCount: number };
    expect(completed.tokenCount).toBe(1500);
  });

  it('should spawn process with correct arguments (-p, --output-format json, --permission-mode acceptEdits)', async () => {
    let capturedArgs: string[] = [];
    const capturingSpawner: ProcessSpawner = (_cmd, args, opts) => {
      capturedArgs = args;
      return spawn('node', [FAKE_CLAUDE_PATH, ...args], opts);
    };

    const adapter = new ClaudeCliAdapter(undefined, { timeoutMs: 10_000 }, capturingSpawner);
    await adapter.execute('/bmad-bmm-dev-story', { projectPath: tmpDir });

    expect(capturedArgs[0]).toBe('-p');
    expect(capturedArgs).toContain('--output-format');
    expect(capturedArgs[capturedArgs.indexOf('--output-format') + 1]).toBe('json');
    expect(capturedArgs).toContain('--permission-mode');
    expect(capturedArgs[capturedArgs.indexOf('--permission-mode') + 1]).toBe('acceptEdits');
  });

  it('should handle timeout with SIGTERM → SIGKILL escalation', async () => {
    const eventBus = new EventBus();
    const failedEvents: unknown[] = [];
    eventBus.on('llm.call.failed', (p: unknown) => failedEvents.push(p));

    const adapter = new ClaudeCliAdapter(
      eventBus,
      { timeoutMs: 500, gracefulShutdownMs: 200 },
      createStubSpawner(),
    );

    const result = await adapter.execute('/test', {
      projectPath: tmpDir,
      story: '--simulate-timeout',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain('timed out');
    expect(result.retryable).toBe(true);
    expect(failedEvents).toHaveLength(1);
    expect((failedEvents[0] as { reason: string }).reason).toBe('timeout');
  }, 15_000);

  it('should classify spawn error as permanent (not retryable)', async () => {
    const brokenSpawner: ProcessSpawner = (_cmd, _args, opts) => {
      return spawn('nonexistent-binary-xyz', [], opts);
    };

    const adapter = new ClaudeCliAdapter(undefined, { timeoutMs: 5_000 }, brokenSpawner);
    const result = await adapter.execute('/test', { projectPath: tmpDir });

    expect(result.success).toBe(false);
    expect(result.output).toContain('spawn error');
    expect(result.retryable).toBe(false);
  });

  it('should classify crash exit code 137 as retryable', async () => {
    const adapter = new ClaudeCliAdapter(undefined, { timeoutMs: 10_000 }, createStubSpawner());
    const result = await adapter.execute('/test', {
      projectPath: tmpDir,
      story: '--simulate-crash',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain('exited with code 137');
    expect(result.retryable).toBe(true);
  });

  it('should leave retryable undefined for rate limit error (let step decide)', async () => {
    const adapter = new ClaudeCliAdapter(undefined, { timeoutMs: 10_000 }, createStubSpawner());
    const result = await adapter.execute('/test', {
      projectPath: tmpDir,
      story: '--simulate-429',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain('429');
    // Exit code 1 is unclassified at adapter level — step's RetryPolicy will
    // pattern-match "429" in output and classify it as transient
    expect(result.retryable).toBeUndefined();
  });
});

// ── Step-Level Tests ──────────────────────────────────────────────────

describe('BMADCommandStep + ClaudeCliAdapter integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should execute dev step successfully with real adapter', async () => {
    const eventBus = new EventBus();
    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 10_000 }, createStubSpawner());
    const step = new BMADDevStoryStep(adapter);

    const context = createWorkflowContext(tmpDir);
    const result = await step.run(context);

    expect(result.status).toBe('ok');
    expect(result.report).toBeDefined();
  });

  it('should retry on crash exit code and exhaust retries', async () => {
    const eventBus = new EventBus();
    const retryEvents: unknown[] = [];
    eventBus.on('bmad.retry.attempt', (p: unknown) => retryEvents.push(p));

    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 10_000 }, createStubSpawner());
    const step = new BMADDevStoryStep(adapter, {
      retryPolicy: new RetryPolicy({ maxRetries: 2, baseDelayMs: 50, backoffMultiplier: 2 }),
      eventBus,
      delayFn: async () => {}, // instant delay for test speed
    });

    const storyContent = SIMPLE_STORY + '\n--simulate-crash';
    const context = createWorkflowContext(tmpDir, storyContent);
    const result = await step.run(context);

    // Crash exit code 137 → retryable → retries exhausted → failed
    expect(result.status).toBe('failed');
    expect(result.error).toBeInstanceOf(BMADRetryExhaustedError);
    expect(retryEvents.length).toBe(2); // 2 retry attempts (after initial)
  }, 30_000);

  it('should not retry permanent error (review failure exit code 1)', async () => {
    const eventBus = new EventBus();
    const retryEvents: unknown[] = [];
    eventBus.on('bmad.retry.attempt', (p: unknown) => retryEvents.push(p));

    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 10_000 }, createStubSpawner());
    const step = new BMADReviewStep(adapter, { eventBus });

    const storyContent = SIMPLE_STORY + '\n--simulate-review-failure';
    const context = createWorkflowContext(tmpDir, storyContent);
    const result = await step.run(context);

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('BMAD code-review failed');
    expect(retryEvents).toHaveLength(0); // No retries for permanent error
  });

  it('should block on budget exhaustion before execution', async () => {
    const adapter = new ClaudeCliAdapter(undefined, { timeoutMs: 10_000 }, createStubSpawner());
    const budgetChecker: BudgetChecker = {
      getBudgetStatus: () => ({ consumed: 1000, remaining: 0, percentage: 100, breakdownByCommand: {}, breakdownByAgent: {} }),
    };
    const step = new BMADDevStoryStep(adapter, { budgetChecker });

    const context = createWorkflowContext(tmpDir);
    const result = await step.run(context);

    expect(result.status).toBe('blocked');
    expect(result.error).toBeInstanceOf(BudgetExhaustedError);
  });

  it('should inject story context correctly via StoryContextBuilder', async () => {
    let capturedPrompt = '';
    const capturingSpawner: ProcessSpawner = (_cmd, args, opts) => {
      const pIndex = args.indexOf('-p');
      if (pIndex !== -1 && pIndex + 1 < args.length) {
        capturedPrompt = args[pIndex + 1]!;
      }
      return spawn('node', [FAKE_CLAUDE_PATH, ...args], opts);
    };

    const adapter = new ClaudeCliAdapter(undefined, { timeoutMs: 10_000 }, capturingSpawner);
    const step = new BMADDevStoryStep(adapter);

    const storyContent = '# My Test Story\n\nAC: It works\n';
    const context = createWorkflowContext(tmpDir, storyContent);
    const result = await step.run(context);

    expect(result.status).toBe('ok');
    // Prompt should contain the command
    expect(capturedPrompt).toContain('/bmad-bmm-dev-story');
    // Prompt should contain story context with story ID
    expect(capturedPrompt).toContain('E1-S1');
    // Prompt should contain the story content
    expect(capturedPrompt).toContain('My Test Story');
  });

  it('should run all three BMAD steps sequentially (dev → review → qa)', async () => {
    const eventBus = new EventBus();
    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 10_000 }, createStubSpawner());

    const steps: WorkflowStep[] = [
      new BMADDevStoryStep(adapter),
      new BMADReviewStep(adapter),
      new BMADQAStep(adapter),
    ];

    const context = createWorkflowContext(tmpDir);

    for (const step of steps) {
      const result = await step.run(context);
      expect(result.status).toBe('ok');
    }
  });
});

// ── Pipeline-Level Tests ──────────────────────────────────────────────

describe('PipelineStepFactory + ClaudeCliAdapter integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should build BMAD pipeline with real adapter and execute successfully', async () => {
    const eventBus = new EventBus();
    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 10_000 }, createStubSpawner());
    const factory = new PipelineStepFactory(eventBus, adapter);

    const config = createWorkflowContext(tmpDir).config;
    const steps = factory.build(config);

    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.name)).toEqual(['bmad-dev', 'bmad-review', 'bmad-qa']);

    // Execute all steps
    const context = createWorkflowContext(tmpDir);
    for (const step of steps) {
      const result = await step.run(context);
      expect(result.status).toBe('ok');
    }
  });

  it('should build legacy pipeline when useBMAD is false', () => {
    const eventBus = new EventBus();
    const factory = new PipelineStepFactory(eventBus);

    const config = { ...createWorkflowContext(tmpDir).config, workflow: { useBMAD: false } };
    const mockConfigLoader = { get: () => config } as unknown as import('../features/config/application/ConfigLoader.js').ConfigLoader;

    const steps = factory.build(config, mockConfigLoader);

    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.name)).toEqual(['dev', 'reviewer', 'qa', 'pm']);
  });

  it('should NOT instantiate BMAD steps when useBMAD is false', () => {
    const eventBus = new EventBus();
    const factory = new PipelineStepFactory(eventBus);

    const config = { ...createWorkflowContext(tmpDir).config, workflow: { useBMAD: false } };
    const mockConfigLoader = { get: () => config } as unknown as import('../features/config/application/ConfigLoader.js').ConfigLoader;

    const steps = factory.build(config, mockConfigLoader);

    // None of the steps should be BMAD steps
    for (const step of steps) {
      expect(step.name).not.toContain('bmad');
    }
  });
});

// ── Full SprintRunner Pipeline Tests ──────────────────────────────────

describe('SprintRunner + BMAD pipeline integration', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = createTempProject();
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
  });

  it('should execute full pipeline: dev → review → qa → story done', async () => {
    const eventBus = new EventBus();
    const events: Array<{ event: string; payload: unknown }> = [];

    eventBus.on('llm.call.started', (p: unknown) => events.push({ event: 'llm.call.started', payload: p }));
    eventBus.on('llm.call.completed', (p: unknown) => events.push({ event: 'llm.call.completed', payload: p }));
    eventBus.on('sprint.starting', (p: unknown) => events.push({ event: 'sprint.starting', payload: p }));
    eventBus.on('sprint.completed', (p: unknown) => events.push({ event: 'sprint.completed', payload: p }));

    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 30_000 }, createStubSpawner());
    const factory = new PipelineStepFactory(eventBus, adapter);
    const runner = new SprintRunner({ projectPath, eventBus, stepFactory: factory });

    const result = await runner.run();

    expect(result.storiesDone).toBe(1);
    expect(result.storiesFailed).toBe(0);
    expect(result.storiesProcessed).toBe(1);
    expect(result.durationMs).toBeGreaterThan(0);

    // Verify story status is 'done' in YAML store
    const store = new YamlStatusStore(projectPath);
    const entries = store.readAll();
    expect(entries.get('E1-S1')?.status).toBe('done');

    // Verify LLM events: 3 steps × (started + completed) = 6 LLM events
    const llmStarted = events.filter((e) => e.event === 'llm.call.started');
    const llmCompleted = events.filter((e) => e.event === 'llm.call.completed');
    expect(llmStarted.length).toBe(3);
    expect(llmCompleted.length).toBe(3);

    // Verify sprint lifecycle events
    expect(events.some((e) => e.event === 'sprint.starting')).toBe(true);
    expect(events.some((e) => e.event === 'sprint.completed')).toBe(true);

    // Verify token tracking (each step: 1500 tokens)
    const totalTokens = llmCompleted.reduce((sum, e) => {
      return sum + ((e.payload as { tokenCount: number }).tokenCount ?? 0);
    }, 0);
    expect(totalTokens).toBe(4500); // 3 steps × 1500
  }, 60_000);

  it('should write JSONL log file with expected events to .cop1/', async () => {
    const eventBus = new EventBus();
    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 30_000 }, createStubSpawner());
    const factory = new PipelineStepFactory(eventBus, adapter);
    const runner = new SprintRunner({ projectPath, eventBus, stepFactory: factory });

    await runner.run();

    // Verify .cop1/ directory exists
    const cop1Dir = join(projectPath, '.cop1');
    expect(existsSync(cop1Dir)).toBe(true);

    // Verify JSONL log file exists with today's date
    const today = new Date().toISOString().slice(0, 10);
    const logFile = join(cop1Dir, `sprint-log-${today}.jsonl`);
    expect(existsSync(logFile)).toBe(true);

    // Verify log contains expected event types
    const logContent = readFileSync(logFile, 'utf-8');
    const entries = logContent.trim().split('\n').map((line) => JSON.parse(line) as { eventType: string });
    const eventTypes = entries.map((e) => e.eventType);

    expect(eventTypes).toContain('llm.call.started');
    expect(eventTypes).toContain('llm.call.completed');
  }, 60_000);

  it('should emit events in correct sequence (sprint → llm calls → sprint complete)', async () => {
    const eventBus = new EventBus();
    const orderedEvents: string[] = [];

    for (const evt of ['sprint.starting', 'llm.call.started', 'llm.call.completed', 'sprint.completed']) {
      eventBus.on(evt, () => orderedEvents.push(evt));
    }

    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 30_000 }, createStubSpawner());
    const factory = new PipelineStepFactory(eventBus, adapter);
    const runner = new SprintRunner({ projectPath, eventBus, stepFactory: factory });

    await runner.run();

    // Verify ordering: sprint.starting must come first, sprint.completed must come last
    expect(orderedEvents[0]).toBe('sprint.starting');
    expect(orderedEvents[orderedEvents.length - 1]).toBe('sprint.completed');

    // All LLM events must be between sprint.starting and sprint.completed
    const llmEvents = orderedEvents.filter((e) => e.startsWith('llm.'));
    expect(llmEvents.length).toBeGreaterThanOrEqual(6); // 3 steps × 2 events
  }, 60_000);

  it('should skip already-completed story on re-execution (idempotency)', async () => {
    const eventBus = new EventBus();
    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 30_000 }, createStubSpawner());
    const factory = new PipelineStepFactory(eventBus, adapter);
    const runner = new SprintRunner({ projectPath, eventBus, stepFactory: factory });

    // First run: story completes
    const result1 = await runner.run();
    expect(result1.storiesDone).toBe(1);

    // Second run: story already done → filtered out → 0 processed
    const result2 = await runner.run();
    expect(result2.storiesProcessed).toBe(0);
    expect(result2.storiesDone).toBe(0);
  }, 60_000);

  it('should mark story as failed when review step fails (no feedback loop)', async () => {
    // NOTE: SprintRunner does NOT implement a dev→review feedback loop.
    // On review failure, the story is marked as failed immediately.
    // A future story should implement the loop with max iteration limit.
    rmSync(projectPath, { recursive: true, force: true });
    projectPath = createTempProject(SIMPLE_STORY + '\n--simulate-review-failure');

    const eventBus = new EventBus();
    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 30_000 }, createStubSpawner());
    const factory = new PipelineStepFactory(eventBus, adapter);
    const runner = new SprintRunner({ projectPath, eventBus, stepFactory: factory });

    const result = await runner.run();

    expect(result.storiesDone).toBe(0);
    expect(result.storiesFailed).toBe(1);
  }, 60_000);
});

// ── State Consistency Tests ───────────────────────────────────────────

describe('State consistency and isolation', () => {
  let tmpDirs: string[];

  beforeEach(() => {
    tmpDirs = [];
  });

  afterEach(() => {
    for (const dir of tmpDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should create isolated temp directories that do not interfere', async () => {
    const dir1 = createTempProject();
    const dir2 = createTempProject();
    tmpDirs.push(dir1, dir2);

    // Both directories should be different
    expect(dir1).not.toBe(dir2);

    // Run pipelines in both
    const eventBus1 = new EventBus();
    const eventBus2 = new EventBus();
    const adapter1 = new ClaudeCliAdapter(eventBus1, { timeoutMs: 10_000 }, createStubSpawner());
    const adapter2 = new ClaudeCliAdapter(eventBus2, { timeoutMs: 10_000 }, createStubSpawner());
    const factory1 = new PipelineStepFactory(eventBus1, adapter1);
    const factory2 = new PipelineStepFactory(eventBus2, adapter2);
    const runner1 = new SprintRunner({ projectPath: dir1, eventBus: eventBus1, stepFactory: factory1 });
    const runner2 = new SprintRunner({ projectPath: dir2, eventBus: eventBus2, stepFactory: factory2 });

    const [result1, result2] = await Promise.all([runner1.run(), runner2.run()]);

    expect(result1.storiesDone).toBe(1);
    expect(result2.storiesDone).toBe(1);

    // Each project has its own status store
    const store1 = new YamlStatusStore(dir1);
    const store2 = new YamlStatusStore(dir2);
    expect(store1.readAll().get('E1-S1')?.status).toBe('done');
    expect(store2.readAll().get('E1-S1')?.status).toBe('done');
  }, 60_000);

  it('should clean up temp directory with no dangling files', () => {
    const dir = createTempDir();
    tmpDirs.push(dir);

    expect(existsSync(dir)).toBe(true);

    // Simulate cleanup
    rmSync(dir, { recursive: true, force: true });
    expect(existsSync(dir)).toBe(false);

    // Remove from tracking since we already cleaned
    tmpDirs = tmpDirs.filter((d) => d !== dir);
  });

  it('should update YAML status store correctly in isolated directory', async () => {
    const dir = createTempProject();
    tmpDirs.push(dir);

    const eventBus = new EventBus();
    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 10_000 }, createStubSpawner());
    const factory = new PipelineStepFactory(eventBus, adapter);
    const runner = new SprintRunner({ projectPath: dir, eventBus, stepFactory: factory });

    await runner.run();

    const store = new YamlStatusStore(dir);
    const entries = store.readAll();
    const status = entries.get('E1-S1');

    expect(status).toBeDefined();
    expect(status!.status).toBe('done');
    expect(status!.updatedAt).toBeDefined();
  }, 30_000);
});

// ── Retry Behavior with Mock Port ─────────────────────────────────────

describe('Retry behavior with transient errors (mock port)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should retry 429 errors with exponential backoff when retryable is undefined', async () => {
    const eventBus = new EventBus();
    const delays: number[] = [];
    let callCount = 0;

    // Mock port that returns 429 with retryable=undefined (so step uses pattern matching)
    const mockPort: BMADCommandPort = {
      async execute(): Promise<BMADCommandResult> {
        callCount++;
        return { success: false, output: 'Error: 429 Too Many Requests', durationMs: 10 };
      },
    };

    const step = new BMADDevStoryStep(mockPort, {
      retryPolicy: new RetryPolicy({ maxRetries: 3, baseDelayMs: 100, backoffMultiplier: 2 }),
      eventBus,
      delayFn: async (ms: number) => { delays.push(ms); },
    });

    const context = createWorkflowContext(tmpDir);
    const result = await step.run(context);

    expect(result.status).toBe('failed');
    expect(result.error).toBeInstanceOf(BMADRetryExhaustedError);
    expect(callCount).toBe(4); // 1 initial + 3 retries
    expect(delays).toEqual([100, 200, 400]); // exponential backoff
  });

  it('should not retry permanent errors (ENOENT)', async () => {
    let callCount = 0;

    const mockPort: BMADCommandPort = {
      async execute(): Promise<BMADCommandResult> {
        callCount++;
        return { success: false, output: 'spawn error: ENOENT', durationMs: 5, retryable: false };
      },
    };

    const step = new BMADDevStoryStep(mockPort, {
      retryPolicy: new RetryPolicy({ maxRetries: 3 }),
    });

    const context = createWorkflowContext(tmpDir);
    const result = await step.run(context);

    expect(result.status).toBe('failed');
    expect(callCount).toBe(1); // No retries
  });
});
