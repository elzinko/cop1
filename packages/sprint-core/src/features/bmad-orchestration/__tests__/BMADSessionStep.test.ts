import type { StructuredLogger } from '@cop1/observability';
import { type Cop1Config, EventBus } from '@cop1/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import {
  BMADSessionStep,
  type BMADSessionStepOptions,
} from '../application/BMADSessionStep.js';
import type { BudgetChecker } from '../application/BMADCommandStep.js';
import { SessionLogger } from '../application/SessionLogger.js';
import { SupervisorService } from '../application/SupervisorService.js';
import { RetryPolicy } from '../domain/RetryPolicy.js';
import { BudgetExhaustedError } from '../domain/errors/BudgetExhaustedError.js';
import type {
  BMADSessionContext,
  BMADSessionPort,
  SessionHandle,
  SessionTurnResult,
} from '../domain/ports/BMADSessionPort.js';
import { InMemorySessionAdapter } from '../infrastructure/InMemorySessionAdapter.js';
import { InMemorySupervisorAdapter } from '../infrastructure/InMemorySupervisorAdapter.js';

function createSessionLogger(): SessionLogger {
  const mockStructuredLogger: Pick<StructuredLogger, 'event'> = { event: vi.fn() };
  return new SessionLogger(mockStructuredLogger as unknown as StructuredLogger);
}

function createSupervisor(): SupervisorService {
  return new SupervisorService(
    new InMemorySupervisorAdapter(new Map()),
    createSessionLogger(),
  );
}

function makeContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    storyId: 'EA9-S4',
    projectPath: '/tmp/test',
    storyContent: '# Story content',
    config: {
      project: { name: 'test', path: '.' },
      daemon: { port: 4242 },
      sprint: { default_duration_hours: 8 },
      resources: {
        ram_budget_night_gb: 48,
        ram_budget_day_gb: 20,
        suspension_threshold_percent: 75,
        polling_interval_ms: 1000,
      },
      llm_routing: {},
      llm_fallback: {},
      git: { auto_merge: false },
      blocage_rules: {},
      schedule: { auto_start: [] },
      workflow: { useBMAD: true },
      budget: { sprint_max_tokens: 0, alert_thresholds: [], auto_pause: false },
    } as unknown as Cop1Config,
    ...overrides,
  };
}

const noDelay = () => Promise.resolve();

const baseOptions: BMADSessionStepOptions = {
  name: 'bmad-dev',
  command: '/bmad-bmm-dev-story',
  errorPrefix: 'BMAD dev-story failed',
  delayFn: noDelay,
};

function turn(partial: Partial<SessionTurnResult>): SessionTurnResult {
  return {
    completed: true,
    output: 'ok',
    durationMs: 0,
    ...partial,
  };
}

describe('BMADSessionStep', () => {
  it('happy path single-turn returns ok with report', async () => {
    const adapter = new InMemorySessionAdapter([turn({ output: 'done' })]);
    const step = new BMADSessionStep(adapter, createSupervisor(), baseOptions);

    const result = await step.run(makeContext());

    expect(result.status).toBe('ok');
    expect(result.report).toBe('done');
  });

  it('multi-turn: first turn !completed → 1 follow-up → completed', async () => {
    const adapter = new InMemorySessionAdapter([
      turn({ completed: false, output: 'pause' }),
      turn({ completed: true, output: 'done' }),
    ]);
    const step = new BMADSessionStep(adapter, createSupervisor(), baseOptions);

    const result = await step.run(makeContext());

    expect(result.status).toBe('ok');
    expect(result.report).toContain('pause');
    expect(result.report).toContain('done');
  });

  it('exceeds follow-up budget (3) → returns failed with errorPrefix', async () => {
    const adapter = new InMemorySessionAdapter([
      turn({ completed: false, output: 'p0' }),
      turn({ completed: false, output: 'p1' }),
      turn({ completed: false, output: 'p2' }),
      turn({ completed: false, output: 'p3' }),
    ]);
    const step = new BMADSessionStep(adapter, createSupervisor(), baseOptions);

    const result = await step.run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('BMAD dev-story failed');
    expect(result.error?.message).toContain('follow-up budget');
  });

  it('session error (turn.error===true) non-transient → failed with errorPrefix', async () => {
    const adapter = new InMemorySessionAdapter([
      turn({
        completed: false,
        output: '',
        error: true,
        errorMessage: 'parse error in workflow',
      }),
    ]);
    const step = new BMADSessionStep(adapter, createSupervisor(), baseOptions);

    const result = await step.run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('BMAD dev-story failed');
    expect(result.error?.message).toContain('parse error');
  });

  it('transient error + retry policy → succeeds on 2nd attempt', async () => {
    // 1st session attempt: transient failure
    // 2nd session attempt: success
    let callCount = 0;
    const adapter: BMADSessionPort = {
      async startSession(_cmd, _ctx): Promise<SessionHandle> {
        callCount++;
        if (callCount === 1) {
          return {
            sessionId: 'sess-1',
            firstTurn: turn({
              completed: false,
              output: '',
              error: true,
              errorMessage: 'rate limit exceeded',
            }),
          };
        }
        return {
          sessionId: 'sess-2',
          firstTurn: turn({ completed: true, output: 'ok-after-retry' }),
        };
      },
      async continueSession(): Promise<SessionTurnResult> {
        throw new Error('should not be called');
      },
    };

    const step = new BMADSessionStep(adapter, createSupervisor(), {
      ...baseOptions,
      retryPolicy: new RetryPolicy({ maxRetries: 2, baseDelayMs: 1 }),
    });

    const result = await step.run(makeContext());

    expect(result.status).toBe('ok');
    expect(result.report).toBe('ok-after-retry');
    expect(callCount).toBe(2);
  });

  it('transient error exhausting retries → returned as failed', async () => {
    const adapter: BMADSessionPort = {
      async startSession(): Promise<SessionHandle> {
        return {
          sessionId: 's',
          firstTurn: turn({
            completed: false,
            output: '',
            error: true,
            errorMessage: 'ECONNRESET',
          }),
        };
      },
      async continueSession(): Promise<SessionTurnResult> {
        throw new Error('nope');
      },
    };
    const step = new BMADSessionStep(adapter, createSupervisor(), {
      ...baseOptions,
      retryPolicy: new RetryPolicy({ maxRetries: 1, baseDelayMs: 1 }),
    });

    const result = await step.run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.name).toBe('BMADRetryExhaustedError');
  });

  it('non-transient error → no retry, fails immediately', async () => {
    let callCount = 0;
    const adapter: BMADSessionPort = {
      async startSession(): Promise<SessionHandle> {
        callCount++;
        return {
          sessionId: 's',
          firstTurn: turn({
            completed: false,
            output: '',
            error: true,
            errorMessage: 'syntax error in story file',
          }),
        };
      },
      async continueSession(): Promise<SessionTurnResult> {
        throw new Error('nope');
      },
    };
    const step = new BMADSessionStep(adapter, createSupervisor(), {
      ...baseOptions,
      retryPolicy: new RetryPolicy({ maxRetries: 3, baseDelayMs: 1 }),
    });

    const result = await step.run(makeContext());

    expect(result.status).toBe('failed');
    expect(callCount).toBe(1);
  });

  it('pre-flight budget remaining<=0 → blocked, no startSession', async () => {
    let started = false;
    const adapter: BMADSessionPort = {
      async startSession(): Promise<SessionHandle> {
        started = true;
        return { sessionId: 's', firstTurn: turn({}) };
      },
      async continueSession(): Promise<SessionTurnResult> {
        return turn({});
      },
    };
    const budgetChecker: BudgetChecker = {
      getBudgetStatus: () => ({
        consumed: 100,
        remaining: 0,
        percentage: 100,
        breakdownByCommand: {},
        breakdownByAgent: {},
      }),
    };
    const step = new BMADSessionStep(adapter, createSupervisor(), {
      ...baseOptions,
      budgetChecker,
    });

    const result = await step.run(makeContext());

    expect(result.status).toBe('blocked');
    expect(result.error).toBeInstanceOf(BudgetExhaustedError);
    expect(started).toBe(false);
  });

  it('mid-retry budget exhausted → blocked', async () => {
    let attempts = 0;
    const adapter: BMADSessionPort = {
      async startSession(): Promise<SessionHandle> {
        attempts++;
        return {
          sessionId: 's',
          firstTurn: turn({
            completed: false,
            output: '',
            error: true,
            errorMessage: 'rate limit',
          }),
        };
      },
      async continueSession(): Promise<SessionTurnResult> {
        throw new Error('nope');
      },
    };
    let budgetCalls = 0;
    const budgetChecker: BudgetChecker = {
      getBudgetStatus: () => {
        budgetCalls++;
        // First call (pre-flight) = remaining > 0; subsequent calls (between retries) = 0
        return budgetCalls === 1
          ? {
              consumed: 0,
              remaining: 100,
              percentage: 0,
              breakdownByCommand: {},
              breakdownByAgent: {},
            }
          : {
              consumed: 100,
              remaining: 0,
              percentage: 100,
              breakdownByCommand: {},
              breakdownByAgent: {},
            };
      },
    };
    const step = new BMADSessionStep(adapter, createSupervisor(), {
      ...baseOptions,
      retryPolicy: new RetryPolicy({ maxRetries: 3, baseDelayMs: 1 }),
      budgetChecker,
    });

    const result = await step.run(makeContext());

    expect(result.status).toBe('blocked');
    expect(result.error).toBeInstanceOf(BudgetExhaustedError);
    expect(attempts).toBe(1);
  });

  it('setWorkflowContext is called with the real sessionId after startSession', async () => {
    const adapter = new InMemorySessionAdapter([
      turn({ completed: false, output: 'p' }),
      turn({ completed: true, output: 'done' }),
    ]);
    const supervisor = createSupervisor();
    const setSpy = vi.spyOn(supervisor, 'setWorkflowContext');
    const continueSpy = vi.spyOn(adapter, 'continueSession');

    const step = new BMADSessionStep(adapter, supervisor, baseOptions);
    await step.run(makeContext());

    // Two calls: pre-start (no sessionId) + post-start (with sessionId)
    expect(setSpy).toHaveBeenCalledTimes(2);
    const secondCall = setSpy.mock.calls[1]!;
    expect(secondCall[0]).toBe('/bmad-bmm-dev-story');
    expect(secondCall[1]).toBe('EA9-S4');
    expect(secondCall[3]).toBeTruthy();
    expect(typeof secondCall[3]).toBe('string');

    // Real sessionId wired BEFORE any continueSession call
    const setOrder = setSpy.mock.invocationCallOrder[1]!;
    const contOrder = continueSpy.mock.invocationCallOrder[0]!;
    expect(setOrder).toBeLessThan(contOrder);
  });

  it('emits bmad.retry.attempt and bmad.retry.transient on retry', async () => {
    let callCount = 0;
    const adapter: BMADSessionPort = {
      async startSession(): Promise<SessionHandle> {
        callCount++;
        if (callCount === 1) {
          return {
            sessionId: 's1',
            firstTurn: turn({
              completed: false,
              output: '',
              error: true,
              errorMessage: 'rate limit',
            }),
          };
        }
        return { sessionId: 's2', firstTurn: turn({ completed: true, output: 'ok' }) };
      },
      async continueSession(): Promise<SessionTurnResult> {
        throw new Error('nope');
      },
    };
    const eventBus = new EventBus();
    const events: Array<{ type: string; payload: unknown }> = [];
    eventBus.on('bmad.retry.attempt', (p: unknown) => events.push({ type: 'attempt', payload: p }));
    eventBus.on('bmad.retry.transient', (p: unknown) =>
      events.push({ type: 'transient', payload: p }),
    );

    const step = new BMADSessionStep(adapter, createSupervisor(), {
      ...baseOptions,
      retryPolicy: new RetryPolicy({ maxRetries: 2, baseDelayMs: 1 }),
      eventBus,
    });

    await step.run(makeContext());

    expect(events.some((e) => e.type === 'attempt')).toBe(true);
    expect(events.some((e) => e.type === 'transient')).toBe(true);
  });

  it('transient error thrown by startSession → retries and succeeds', async () => {
    let callCount = 0;
    const adapter: BMADSessionPort = {
      async startSession(): Promise<SessionHandle> {
        callCount++;
        if (callCount === 1) {
          throw new Error('ECONNRESET while opening session');
        }
        return { sessionId: 's2', firstTurn: turn({ completed: true, output: 'ok' }) };
      },
      async continueSession(): Promise<SessionTurnResult> {
        throw new Error('nope');
      },
    };

    const step = new BMADSessionStep(adapter, createSupervisor(), {
      ...baseOptions,
      retryPolicy: new RetryPolicy({ maxRetries: 2, baseDelayMs: 1 }),
    });

    const result = await step.run(makeContext());

    expect(result.status).toBe('ok');
    expect(result.report).toBe('ok');
    expect(callCount).toBe(2);
  });

  it('thrown error from continueSession → returned as failed with prefix', async () => {
    const adapter: BMADSessionPort = {
      async startSession(): Promise<SessionHandle> {
        return {
          sessionId: 's',
          firstTurn: turn({ completed: false, output: 'p' }),
        };
      },
      async continueSession(): Promise<SessionTurnResult> {
        throw new Error('syntax boom');
      },
    };
    const step = new BMADSessionStep(adapter, createSupervisor(), baseOptions);

    const result = await step.run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('BMAD dev-story failed');
    expect(result.error?.message).toContain('syntax boom');
  });

  it('session with all-empty output → failed (no silent empty success)', async () => {
    const adapter = new InMemorySessionAdapter([turn({ completed: true, output: '' })]);
    const step = new BMADSessionStep(adapter, createSupervisor(), baseOptions);

    const result = await step.run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('empty output');
  });

  it('setWorkflowContext is called BEFORE startSession on the first invocation', async () => {
    const adapter = new InMemorySessionAdapter([turn({ output: 'done' })]);
    const supervisor = createSupervisor();
    const setSpy = vi.spyOn(supervisor, 'setWorkflowContext');
    const startSpy = vi.spyOn(adapter, 'startSession');

    const step = new BMADSessionStep(adapter, supervisor, baseOptions);
    await step.run(makeContext());

    expect(setSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      startSpy.mock.invocationCallOrder[0]!,
    );
    expect(setSpy.mock.calls[0]![3]).toBeUndefined();
  });

  it.each([
    { name: 'bmad-dev', command: '/bmad-bmm-dev-story', errorPrefix: 'BMAD dev failed' },
    { name: 'bmad-review', command: '/bmad-bmm-code-review', errorPrefix: 'BMAD review failed' },
    { name: 'bmad-qa', command: '/bmad-bmm-qa-automate', errorPrefix: 'BMAD qa failed' },
  ])('parametric: $name uses options correctly', async ({ name, command, errorPrefix }) => {
    let capturedCmd = '';
    const adapter: BMADSessionPort = {
      async startSession(cmd, _ctx: BMADSessionContext): Promise<SessionHandle> {
        capturedCmd = cmd;
        return {
          sessionId: 's',
          firstTurn: turn({
            completed: false,
            output: '',
            error: true,
            errorMessage: 'permanent failure',
          }),
        };
      },
      async continueSession(): Promise<SessionTurnResult> {
        throw new Error('nope');
      },
    };
    const step = new BMADSessionStep(adapter, createSupervisor(), {
      name,
      command,
      errorPrefix,
      delayFn: noDelay,
    });

    expect(step.name).toBe(name);

    const result = await step.run(makeContext());

    expect(capturedCmd).toBe(command);
    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain(errorPrefix);
  });
});
