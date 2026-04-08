import type { Cop1Config } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import { ReviewerAgent } from '../application/ReviewerAgent.js';
import { MaxRejectionsError } from '../domain/ReviewResult.js';
import type { ReviewerPort } from '../domain/ports/ReviewerPort.js';

function createContext(): WorkflowContext {
  return {
    storyId: 'E1-S1',
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
  };
}

describe('ReviewerAgent', () => {
  it('should approve when reviewer approves', async () => {
    const reviewer: ReviewerPort = {
      review: async () => ({ verdict: 'approve', comments: [] }),
    };
    const agent = new ReviewerAgent(reviewer);

    const result = await agent.run(createContext());

    expect(result.status).toBe('ok');
  });

  it('should fail when reviewer requests changes', async () => {
    const reviewer: ReviewerPort = {
      review: async () => ({ verdict: 'request-changes', comments: ['Missing tests'] }),
    };
    const agent = new ReviewerAgent(reviewer);

    const result = await agent.run(createContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('Missing tests');
  });

  it('should block after max rejections', async () => {
    const reviewer: ReviewerPort = {
      review: async () => ({ verdict: 'request-changes', comments: ['Bad code'] }),
    };
    const agent = new ReviewerAgent(reviewer, 2);
    const context = createContext();

    await agent.run(context); // rejection 1
    const result = await agent.run(context); // rejection 2 → max reached

    expect(result.status).toBe('blocked');
    expect(result.error).toBeInstanceOf(MaxRejectionsError);
  });

  it('should reset rejection count after approval', async () => {
    let callCount = 0;
    const reviewer: ReviewerPort = {
      review: async () => {
        callCount++;
        if (callCount <= 1) return { verdict: 'request-changes', comments: ['Fix'] };
        return { verdict: 'approve', comments: [] };
      },
    };
    const agent = new ReviewerAgent(reviewer, 3);
    const context = createContext();

    await agent.run(context); // rejection 1
    const result = await agent.run(context); // approval

    expect(result.status).toBe('ok');
  });

  it('should handle reviewer errors gracefully', async () => {
    const reviewer: ReviewerPort = {
      review: async () => {
        throw new Error('LLM unavailable');
      },
    };
    const agent = new ReviewerAgent(reviewer);

    const result = await agent.run(createContext());

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('LLM unavailable');
  });
});
