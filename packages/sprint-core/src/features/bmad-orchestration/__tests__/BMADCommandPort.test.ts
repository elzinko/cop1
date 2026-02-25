import type { Cop1Config } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import { BMADCommandStep } from '../application/BMADCommandStep.js';
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
    } satisfies Cop1Config,
    ...overrides,
  };
}

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
});
