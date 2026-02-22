import type { Cop1Config } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import { BMADReviewStep } from '../application/BMADReviewStep.js';
import type { BMADCommandPort } from '../domain/ports/BMADCommandPort.js';

function makeContext(): WorkflowContext {
  return {
    storyId: 'EA1-S3',
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

describe('BMADReviewStep', () => {
  it('has name "bmad-review"', () => {
    const port: BMADCommandPort = {
      execute: async () => ({ success: true, output: 'ok', durationMs: 100 }),
    };
    expect(new BMADReviewStep(port).name).toBe('bmad-review');
  });

  it('calls /bmad-bmm-code-review command', async () => {
    let capturedCommand = '';
    const port: BMADCommandPort = {
      execute: async (cmd) => {
        capturedCommand = cmd;
        return { success: true, output: 'ok', durationMs: 100 };
      },
    };

    await new BMADReviewStep(port).run(makeContext());

    expect(capturedCommand).toBe('/bmad-bmm-code-review');
  });

  it('returns ok on success', async () => {
    const port: BMADCommandPort = {
      execute: async () => ({ success: true, output: 'Review passed', durationMs: 100 }),
    };

    const result = await new BMADReviewStep(port).run(makeContext());

    expect(result.status).toBe('ok');
    expect(result.report).toBe('Review passed');
  });

  it('uses "BMAD code-review failed" as error prefix', async () => {
    const port: BMADCommandPort = {
      execute: async () => ({ success: false, output: 'issues found', durationMs: 50 }),
    };

    const result = await new BMADReviewStep(port).run(makeContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('BMAD code-review failed');
  });
});
