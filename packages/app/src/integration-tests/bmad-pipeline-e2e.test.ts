import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import {
  type BMADSessionPort,
  InMemorySessionAdapter,
  InMemoryStatusReader,
  InMemorySupervisorAdapter,
  SessionLogger,
  type SessionTurnResult,
  SupervisorService,
} from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelineStepFactory } from '../composition/PipelineStepFactory.js';
import { SprintRunner } from '../composition/SprintRunner.js';

// ── Fixtures ──────────────────────────────────────────────────────────

function createTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cop1-integ-'));

  // Write cop1.config.yaml from fixture
  // (file copy via writeFile to avoid extra cpSync import)
  const cfg = `project:
  name: test
  path: .
daemon:
  port: 4242
sprint:
  default_duration_hours: 1
resources:
  ram_budget_night_gb: 8
  ram_budget_day_gb: 8
  suspension_threshold_percent: 75
  polling_interval_ms: 1000
llm_routing: {}
llm_fallback: {}
git:
  auto_merge: false
workflow:
  useBMAD: true
blocage_rules: {}
schedule:
  auto_start: []
budget:
  sprint_max_tokens: 1000000
  alert_thresholds: [50, 80, 95]
  auto_pause: true
`;
  writeFileSync(join(dir, 'cop1.config.yaml'), cfg);

  const storiesDir = join(dir, '_bmad-output', 'planning-artifacts', 'stories', 'sprint-0');
  mkdirSync(storiesDir, { recursive: true });
  writeFileSync(
    join(storiesDir, 'E1-S1.md'),
    '# E1-S1: Test Story\n\nStatus: ready-for-dev\n\n## Acceptance Criteria\n- Works\n',
  );

  const implDir = join(dir, '_bmad-output', 'implementation-artifacts');
  mkdirSync(implDir, { recursive: true });
  writeFileSync(
    join(implDir, 'sprint-status.yaml'),
    'development_status:\n  E1-S1: ready-for-dev\n',
  );

  return dir;
}

function buildSuccessfulSession(): BMADSessionPort {
  // 3 BMADSessionStep instances will each call startSession() once. Provide
  // 3 successful first-turns. Each adapter call shifts one off the queue.
  const turns: SessionTurnResult[] = [
    { completed: true, output: 'dev done', durationMs: 1 },
    { completed: true, output: 'review done', durationMs: 1 },
    { completed: true, output: 'qa done', durationMs: 1 },
  ];
  return new InMemorySessionAdapter(turns);
}

function createSupervisor(): SupervisorService {
  const supervisorAdapter = new InMemorySupervisorAdapter(new Map());
  const stubStructuredLogger = { event: () => {} } as unknown as ConstructorParameters<
    typeof SessionLogger
  >[0];
  const sessionLogger = new SessionLogger(stubStructuredLogger);
  return new SupervisorService(supervisorAdapter, sessionLogger);
}

// ── PipelineStepFactory wiring ────────────────────────────────────────

describe('PipelineStepFactory + InMemory session adapters', () => {
  it('builds three BMADSessionStep instances in dev/review/qa order', () => {
    const eventBus = new EventBus();
    const sessionPort = buildSuccessfulSession();
    const supervisorService = createSupervisor();
    const factory = new PipelineStepFactory(eventBus, { sessionPort, supervisorService });

    const steps = factory.build({
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
      budget: { sprint_max_tokens: 0, alert_thresholds: [], auto_pause: false },
    });

    expect(steps.map((s) => s.name)).toEqual(['bmad-dev', 'bmad-review', 'bmad-qa']);
  });
});

// ── Full SprintRunner end-to-end ──────────────────────────────────────

describe('SprintRunner + BMAD session pipeline (in-memory adapters)', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = createTempProject();
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
  });

  it('runs dev → review → qa via three BMADSessionStep instances', async () => {
    const eventBus = new EventBus();
    // Spy on legacy events to ensure none are emitted on the new code path.
    const legacyEvents: string[] = [];
    for (const evt of ['bmad.command.started', 'bmad.command.completed', 'bmad.command.failed']) {
      eventBus.on(evt, () => legacyEvents.push(evt));
    }

    const sessionPort = buildSuccessfulSession();
    const supervisorService = createSupervisor();
    const setContextSpy = vi.spyOn(supervisorService, 'setWorkflowContext');

    const statusReader = new InMemoryStatusReader(new Map([['E1-S1', 'ready-for-dev']]));
    const factory = new PipelineStepFactory(eventBus, { sessionPort, supervisorService });
    const runner = new SprintRunner({
      projectPath,
      eventBus,
      stepFactory: factory,
      statusReader,
    });

    const result = await runner.run();

    expect(result.storiesProcessed).toBeGreaterThanOrEqual(1);
    expect(result.storiesFailed).toBe(0);

    // SupervisorService.setWorkflowContext should be called at least 3 times
    // (once before startSession + once after, per BMADSessionStep). The first
    // arg of each call is the command — we check the dev/review/qa command
    // strings appear in order across the call log.
    const calledCommands = setContextSpy.mock.calls.map((c) => c[0] as string);
    expect(calledCommands.filter((c) => c === '/bmad-bmm-dev-story').length).toBeGreaterThan(0);
    expect(calledCommands.filter((c) => c === '/bmad-bmm-code-review').length).toBeGreaterThan(0);
    expect(calledCommands.filter((c) => c === '/bmad-bmm-qa-automate').length).toBeGreaterThan(0);
    const firstDev = calledCommands.indexOf('/bmad-bmm-dev-story');
    const firstReview = calledCommands.indexOf('/bmad-bmm-code-review');
    const firstQa = calledCommands.indexOf('/bmad-bmm-qa-automate');
    expect(firstDev).toBeLessThan(firstReview);
    expect(firstReview).toBeLessThan(firstQa);

    // No legacy bmad.command.* events leaked through.
    expect(legacyEvents).toHaveLength(0);
  }, 10_000);
});
