import type { Cop1Config } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import { BMADQAStep } from '../application/BMADQAStep.js';
import type { BMADCommandPort } from '../domain/ports/BMADCommandPort.js';

function makeContext(): WorkflowContext {
  return {
    storyId: 'EA1-S4',
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
    } satisfies Cop1Config,
  };
}

describe('BMADQAStep', () => {
  it('has name "bmad-qa"', () => {
    const port: BMADCommandPort = {
      execute: async () => ({ success: true, output: 'ok', durationMs: 100 }),
    };
    expect(new BMADQAStep(port).name).toBe('bmad-qa');
  });

  it('calls /bmad-bmm-qa-automate command', async () => {
    let capturedCommand = '';
    const port: BMADCommandPort = {
      execute: async (cmd) => {
        capturedCommand = cmd;
        return { success: true, output: 'ok', durationMs: 100 };
      },
    };

    await new BMADQAStep(port).run(makeContext());

    expect(capturedCommand).toBe('/bmad-bmm-qa-automate');
  });

  it('returns ok on success with QA summary', async () => {
    const port: BMADCommandPort = {
      execute: async () => ({
        success: true,
        output: 'All tests pass. AC coverage verified.',
        durationMs: 200,
      }),
    };

    const result = await new BMADQAStep(port).run(makeContext());

    expect(result.status).toBe('ok');
    expect(result.report).toBe('All tests pass. AC coverage verified.');
  });

  it('returns failed with error prefix on failure', async () => {
    const port: BMADCommandPort = {
      execute: async () => ({ success: false, output: '3 tests failed', durationMs: 150 }),
    };

    const result = await new BMADQAStep(port).run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('BMAD QA validation failed');
  });

  it('injects story context via StoryContextBuilder', async () => {
    let capturedContext: Record<string, string> = {};
    const port: BMADCommandPort = {
      execute: async (_cmd, ctx) => {
        capturedContext = ctx;
        return { success: true, output: 'ok', durationMs: 100 };
      },
    };

    const context = makeContext();
    context.storyContent = 'Test story content';
    await new BMADQAStep(port).run(context);

    expect(capturedContext.projectPath).toBe('/tmp/test');
    expect(capturedContext.story).toContain('EA1-S4');
    expect(capturedContext.story).toContain('Test story content');
  });

  it('handles thrown exceptions gracefully', async () => {
    const port: BMADCommandPort = {
      execute: async () => {
        throw new Error('Connection refused');
      },
    };

    const result = await new BMADQAStep(port).run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('Connection refused');
  });
});
