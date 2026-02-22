import type { Cop1Config } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import { BMADDevStoryStep } from '../application/BMADDevStoryStep.js';
import type { BMADCommandPort } from '../domain/ports/BMADCommandPort.js';

function makeContext(): WorkflowContext {
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
    } satisfies Cop1Config,
  };
}

describe('BMADDevStoryStep', () => {
  it('has name "bmad-dev"', () => {
    const port: BMADCommandPort = {
      execute: async () => ({ success: true, output: 'ok', durationMs: 100 }),
    };
    expect(new BMADDevStoryStep(port).name).toBe('bmad-dev');
  });

  it('calls /bmad-bmm-dev-story command', async () => {
    let capturedCommand = '';
    const port: BMADCommandPort = {
      execute: async (cmd) => {
        capturedCommand = cmd;
        return { success: true, output: 'ok', durationMs: 100 };
      },
    };

    await new BMADDevStoryStep(port).run(makeContext());

    expect(capturedCommand).toBe('/bmad-bmm-dev-story');
  });

  it('returns ok on success', async () => {
    const port: BMADCommandPort = {
      execute: async () => ({ success: true, output: 'done', durationMs: 100 }),
    };

    const result = await new BMADDevStoryStep(port).run(makeContext());

    expect(result.status).toBe('ok');
    expect(result.report).toBe('done');
  });

  it('uses "BMAD dev-story failed" as error prefix', async () => {
    const port: BMADCommandPort = {
      execute: async () => ({ success: false, output: 'bad', durationMs: 50 }),
    };

    const result = await new BMADDevStoryStep(port).run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('BMAD dev-story failed');
  });
});
