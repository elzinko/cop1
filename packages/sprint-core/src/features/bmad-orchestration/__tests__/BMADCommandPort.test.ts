import { type Cop1Config, EventBus } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import { BMADCommandStep, type BudgetChecker } from '../application/BMADCommandStep.js';
import { RetryPolicy } from '../domain/RetryPolicy.js';
import { BMADRetryExhaustedError } from '../domain/errors/BMADRetryExhaustedError.js';
import { BudgetExhaustedError } from '../domain/errors/BudgetExhaustedError.js';
import type { BMADCommandPort } from '../domain/ports/BMADCommandPort.js';

class TestStep extends BMADCommandStep {
  readonly name = 'test-step';
  protected readonly command = '/test-command';
  protected readonly errorPrefix = 'Test step failed';
}

function makeContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    storyId: 'EA1-S1',
    projectPath: '/tmp/test',
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
    } satisfies Cop1Config,
    ...overrides,
  };
}

const noDelay = () => Promise.resolve();

describe('BMADCommandStep', () => {
  it('delegates to commandPort with correct command', async () => {
    let capturedCommand = '';
    const port: BMADCommandPort = {
      execute: async (cmd) => {
        capturedCommand = cmd;
        return { success: true, output: 'ok', durationMs: 100 };
      },
    };

    const step = new TestStep(port);
    await step.run(makeContext());

    expect(capturedCommand).toBe('/test-command');
  });

  it('returns ok with report on success', async () => {
    const port: BMADCommandPort = {
      execute: async () => ({ success: true, output: 'All done', durationMs: 100 }),
    };

    const step = new TestStep(port);
    const result = await step.run(makeContext());

    expect(result.status).toBe('ok');
    expect(result.report).toBe('All done');
  });

  it('returns failed with errorPrefix on command failure', async () => {
    const port: BMADCommandPort = {
      execute: async () => ({ success: false, output: 'bad', durationMs: 50 }),
    };

    const step = new TestStep(port);
    const result = await step.run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('Test step failed');
    expect(result.error?.message).toContain('bad');
  });

  it('returns failed on thrown error', async () => {
    const port: BMADCommandPort = {
      execute: async () => {
        throw new Error('boom');
      },
    };

    const step = new TestStep(port);
    const result = await step.run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('boom');
  });

  it('passes story context including storyId', async () => {
    let capturedCtx: Record<string, string> = {};
    const port: BMADCommandPort = {
      execute: async (_cmd, ctx) => {
        capturedCtx = ctx;
        return { success: true, output: 'ok', durationMs: 100 };
      },
    };

    const step = new TestStep(port);
    await step.run(makeContext({ storyContent: '## AC\n1. Do X' }));

    expect(capturedCtx.story).toContain('EA1-S1');
    expect(capturedCtx.story).toContain('## AC');
  });

  it('uses storyId as fallback when no storyContent', async () => {
    let capturedCtx: Record<string, string> = {};
    const port: BMADCommandPort = {
      execute: async (_cmd, ctx) => {
        capturedCtx = ctx;
        return { success: true, output: 'ok', durationMs: 100 };
      },
    };

    const step = new TestStep(port);
    await step.run(makeContext({ storyContent: undefined }));

    expect(capturedCtx.story).toContain('EA1-S1');
  });

  it('truncates long error output to 500 chars', async () => {
    const longOutput = 'x'.repeat(1000);
    const port: BMADCommandPort = {
      execute: async () => ({ success: false, output: longOutput, durationMs: 50 }),
    };

    const step = new TestStep(port);
    const result = await step.run(makeContext());

    expect(result.error?.message.length).toBeLessThan(600);
  });

  describe('Retry with exponential backoff', () => {
    it('retries transient errors with backoff then succeeds', async () => {
      let attempt = 0;
      const port: BMADCommandPort = {
        execute: async () => {
          attempt++;
          if (attempt < 3) {
            return { success: false, output: 'HTTP 429 rate limit exceeded', durationMs: 50 };
          }
          return { success: true, output: 'success', durationMs: 100 };
        },
      };

      const delays: number[] = [];
      const delayFn = async (ms: number) => {
        delays.push(ms);
      };

      const step = new TestStep(port, {
        retryPolicy: new RetryPolicy({ maxRetries: 3, baseDelayMs: 100, backoffMultiplier: 2 }),
        delayFn,
      });
      const result = await step.run(makeContext());

      expect(result.status).toBe('ok');
      expect(attempt).toBe(3); // 2 failures + 1 success
      expect(delays).toEqual([100, 200]); // exponential backoff: 100*2^0, 100*2^1
    });

    it('does not retry permanent errors', async () => {
      let attempt = 0;
      const port: BMADCommandPort = {
        execute: async () => {
          attempt++;
          return { success: false, output: 'Invalid command syntax', durationMs: 50 };
        },
      };

      const step = new TestStep(port, {
        retryPolicy: new RetryPolicy({ maxRetries: 3 }),
        delayFn: noDelay,
      });
      const result = await step.run(makeContext());

      expect(result.status).toBe('failed');
      expect(attempt).toBe(1); // No retries for permanent errors
    });

    it('returns failed with BMADRetryExhaustedError when all retries exhausted', async () => {
      let attempt = 0;
      const port: BMADCommandPort = {
        execute: async () => {
          attempt++;
          return { success: false, output: 'HTTP 503 Service Unavailable', durationMs: 50 };
        },
      };

      const step = new TestStep(port, {
        retryPolicy: new RetryPolicy({ maxRetries: 2, baseDelayMs: 10, backoffMultiplier: 2 }),
        delayFn: noDelay,
      });
      const result = await step.run(makeContext());

      expect(result.status).toBe('failed');
      expect(result.error).toBeInstanceOf(BMADRetryExhaustedError);
      expect(attempt).toBe(3); // 1 initial + 2 retries
    });

    it('retries on timeout errors', async () => {
      let attempt = 0;
      const port: BMADCommandPort = {
        execute: async () => {
          attempt++;
          if (attempt === 1) {
            return {
              success: false,
              output: 'Claude CLI timed out after 600000ms',
              durationMs: 600000,
            };
          }
          return { success: true, output: 'success', durationMs: 100 };
        },
      };

      const step = new TestStep(port, {
        retryPolicy: new RetryPolicy({ maxRetries: 3 }),
        delayFn: noDelay,
      });
      const result = await step.run(makeContext());

      expect(result.status).toBe('ok');
      expect(attempt).toBe(2);
    });

    it('uses retryable field from result when provided', async () => {
      let attempt = 0;
      const port: BMADCommandPort = {
        execute: async () => {
          attempt++;
          // Output looks transient by string matching, but retryable=false overrides
          return {
            success: false,
            output: 'HTTP 503 Service Unavailable',
            durationMs: 50,
            retryable: false,
          };
        },
      };

      const step = new TestStep(port, {
        retryPolicy: new RetryPolicy({ maxRetries: 3 }),
        delayFn: noDelay,
      });
      const result = await step.run(makeContext());

      expect(result.status).toBe('failed');
      expect(attempt).toBe(1); // No retries because retryable=false
    });

    it('falls back to string matching when retryable is undefined', async () => {
      let attempt = 0;
      const port: BMADCommandPort = {
        execute: async () => {
          attempt++;
          if (attempt < 3) {
            return { success: false, output: 'HTTP 503 Service Unavailable', durationMs: 50 };
          }
          return { success: true, output: 'ok', durationMs: 100 };
        },
      };

      const step = new TestStep(port, {
        retryPolicy: new RetryPolicy({ maxRetries: 3 }),
        delayFn: noDelay,
      });
      const result = await step.run(makeContext());

      expect(result.status).toBe('ok');
      expect(attempt).toBe(3); // String matching used as fallback
    });

    it('retries on process crash exit codes', async () => {
      let attempt = 0;
      const port: BMADCommandPort = {
        execute: async () => {
          attempt++;
          if (attempt === 1) {
            return { success: false, output: 'Claude CLI exited with code 137: ', durationMs: 50 };
          }
          return { success: true, output: 'success', durationMs: 100 };
        },
      };

      const step = new TestStep(port, {
        retryPolicy: new RetryPolicy({ maxRetries: 3 }),
        delayFn: noDelay,
      });
      const result = await step.run(makeContext());

      expect(result.status).toBe('ok');
      expect(attempt).toBe(2);
    });

    it('emits bmad.retry.attempt events on retries', async () => {
      const eventBus = new EventBus();
      const retryEvents: unknown[] = [];
      eventBus.on('bmad.retry.attempt', (payload) => retryEvents.push(payload));

      let attempt = 0;
      const port: BMADCommandPort = {
        execute: async () => {
          attempt++;
          if (attempt < 3) {
            return { success: false, output: 'HTTP 429 rate limit', durationMs: 50 };
          }
          return { success: true, output: 'ok', durationMs: 100 };
        },
      };

      const step = new TestStep(port, {
        retryPolicy: new RetryPolicy({ maxRetries: 3, baseDelayMs: 100, backoffMultiplier: 2 }),
        delayFn: noDelay,
        eventBus,
      });
      await step.run(makeContext());

      expect(retryEvents).toHaveLength(2);
      expect(retryEvents[0]).toEqual({
        step: 'test-step',
        attempt: 1,
        maxRetries: 3,
        delayMs: 100,
      });
      expect(retryEvents[1]).toEqual({
        step: 'test-step',
        attempt: 2,
        maxRetries: 3,
        delayMs: 200,
      });
    });
  });

  describe('Budget exhaustion handling', () => {
    it('returns blocked when budget is exhausted before command', async () => {
      const port: BMADCommandPort = {
        execute: async () => ({ success: true, output: 'ok', durationMs: 100 }),
      };

      const budgetChecker: BudgetChecker = {
        getBudgetStatus: () => ({
          consumed: 1_000_000,
          remaining: 0,
          percentage: 100,
          breakdownByCommand: {},
          breakdownByAgent: {},
        }),
      };

      const step = new TestStep(port, { budgetChecker });
      const result = await step.run(makeContext());

      expect(result.status).toBe('blocked');
      expect(result.error).toBeInstanceOf(BudgetExhaustedError);
    });

    it('proceeds when budget has remaining tokens', async () => {
      const port: BMADCommandPort = {
        execute: async () => ({ success: true, output: 'ok', durationMs: 100 }),
      };

      const budgetChecker: BudgetChecker = {
        getBudgetStatus: () => ({
          consumed: 500_000,
          remaining: 500_000,
          percentage: 50,
          breakdownByCommand: {},
          breakdownByAgent: {},
        }),
      };

      const step = new TestStep(port, { budgetChecker });
      const result = await step.run(makeContext());

      expect(result.status).toBe('ok');
    });

    it('skips budget check when no budgetChecker is provided', async () => {
      const port: BMADCommandPort = {
        execute: async () => ({ success: true, output: 'ok', durationMs: 100 }),
      };

      const step = new TestStep(port); // No budgetChecker
      const result = await step.run(makeContext());

      expect(result.status).toBe('ok');
    });

    it('aborts retry when budget exhausted mid-retry', async () => {
      let attempt = 0;
      let budgetRemaining = 100_000;

      const port: BMADCommandPort = {
        execute: async () => {
          attempt++;
          budgetRemaining = 0; // Budget exhausted after first call
          return { success: false, output: 'HTTP 503 Service Unavailable', durationMs: 50 };
        },
      };

      const budgetChecker: BudgetChecker = {
        getBudgetStatus: () => ({
          consumed: 1_000_000 - budgetRemaining,
          remaining: budgetRemaining,
          percentage: ((1_000_000 - budgetRemaining) / 1_000_000) * 100,
          breakdownByCommand: {},
          breakdownByAgent: {},
        }),
      };

      const step = new TestStep(port, {
        retryPolicy: new RetryPolicy({ maxRetries: 3 }),
        budgetChecker,
        delayFn: noDelay,
      });
      const result = await step.run(makeContext());

      expect(result.status).toBe('blocked');
      expect(result.error).toBeInstanceOf(BudgetExhaustedError);
      expect(attempt).toBe(1); // Only one attempt before budget check stops retry
    });
  });
});
