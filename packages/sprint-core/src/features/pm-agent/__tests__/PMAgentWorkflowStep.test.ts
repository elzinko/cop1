import { describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import { PMAgentWorkflowStep } from '../application/PMAgentWorkflowStep.js';

function makeContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    storyId: 'E3-S18',
    projectPath: '/tmp/test',
    config: {
      project: { name: 'test', path: '.' },
      daemon: { port: 4242 },
      sprint: { default_duration_hours: 2 },
      resources: {
        ram_budget_night_gb: 48,
        ram_budget_day_gb: 20,
        suspension_threshold_percent: 75,
        polling_interval_ms: 1000,
      },
      llm_routing: { default: 'test' },
      llm_fallback: { default: 'test' },
      git: { auto_merge: false },
      blocage_rules: {},
      schedule: { auto_start: [] },
      workflow: { useBMAD: true },
      budget: { sprint_max_tokens: 0, alert_thresholds: [], auto_pause: false },
    },
    ...overrides,
  };
}

const STORY_WITH_ACS = `# Story E3.S18: PM Agent Wiring

## Story

As a Developer, I want PM validation.

## Acceptance Criteria

1. PMAgentStep is replaced by a real PMAgentWorkflowStep
2. If PM agent cannot validate, it returns ok with a warning

## Tasks / Subtasks

- [ ] Create PMAgentWorkflowStep class
- [ ] Wire in SprintRunner

## Dev Notes

- The step MUST be graceful
`;

const STORY_WITHOUT_ACS = `# Story E1.S1: Simple Story

## Story

As a Developer, I want something simple.

## Dev Notes

- Just some notes here
`;

describe('PMAgentWorkflowStep', () => {
  it('has name "pm"', () => {
    const step = new PMAgentWorkflowStep();
    expect(step.name).toBe('pm');
  });

  it('produces a validation report when story has ACs', async () => {
    const step = new PMAgentWorkflowStep();
    const result = await step.run(makeContext({ storyContent: STORY_WITH_ACS }));

    expect(result.status).toBe('ok');
    expect(result.report).toContain('PM Validation Report');
    expect(result.report).toContain('E3-S18');
    expect(result.report).toContain('PMAgentStep is replaced');
    expect(result.report).toContain('2');
  });

  it('returns ok with warning when no storyContent', async () => {
    const step = new PMAgentWorkflowStep();
    const result = await step.run(makeContext({ storyContent: undefined }));

    expect(result.status).toBe('ok');
    expect(result.report).toContain('WARNING');
    expect(result.report).toContain('No story content');
  });

  it('returns ok with warning when story has no AC section', async () => {
    const step = new PMAgentWorkflowStep();
    const result = await step.run(makeContext({ storyContent: STORY_WITHOUT_ACS }));

    expect(result.status).toBe('ok');
    expect(result.report).toContain('WARNING');
    expect(result.report).toContain('No acceptance criteria');
  });

  it('returns ok with warning on empty story content', async () => {
    const step = new PMAgentWorkflowStep();
    const result = await step.run(makeContext({ storyContent: '' }));

    expect(result.status).toBe('ok');
    expect(result.report).toContain('WARNING');
  });

  it('never returns failed status', async () => {
    const step = new PMAgentWorkflowStep();

    const scenarios = [
      makeContext({ storyContent: undefined }),
      makeContext({ storyContent: '' }),
      makeContext({ storyContent: 'random text' }),
      makeContext({ storyContent: STORY_WITH_ACS }),
      makeContext({ storyContent: STORY_WITHOUT_ACS }),
    ];

    for (const ctx of scenarios) {
      const result = await step.run(ctx);
      expect(result.status).not.toBe('failed');
      expect(result.status).toBe('ok');
    }
  });

  it('handles story with ACs as bullet points', async () => {
    const storyContent = `# Story

## Acceptance Criteria

- First criterion
- Second criterion
- Third criterion
`;
    const step = new PMAgentWorkflowStep();
    const result = await step.run(makeContext({ storyContent }));

    expect(result.status).toBe('ok');
    expect(result.report).toContain('PM Validation Report');
    expect(result.report).toContain('First criterion');
  });
});
