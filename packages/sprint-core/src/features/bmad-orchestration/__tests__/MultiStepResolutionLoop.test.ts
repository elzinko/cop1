import { describe, expect, it, vi } from 'vitest';
import {
  MultiStepResolutionLoop,
  type ResolutionState,
} from '../application/MultiStepResolutionLoop.js';
import type { SupervisorService } from '../application/SupervisorService.js';
import type {
  SupervisorContext,
  SupervisorQuestion,
  SupervisorResponse,
} from '../domain/ports/SupervisorLLMPort.js';
import type { SupervisorToolHandlers } from '../infrastructure/tools/toolCatalog.js';

function makeContext(): SupervisorContext {
  return {
    workflowCommand: '/bmad-bmm-dev-story',
    storyId: 'EA10-S8',
    storyContent: '',
    projectContext: '',
    architectureRules: '',
    iamtheLawRules: '',
    sessionHistory: [],
    currentQuestion: 'Proceed?',
  };
}

function makeSupervisor(respondResult: SupervisorResponse): SupervisorService {
  return {
    respond: vi.fn(async (_q: SupervisorQuestion, _c: SupervisorContext) => respondResult),
  } as unknown as SupervisorService;
}

function makeTools(over: Partial<SupervisorToolHandlers> = {}): SupervisorToolHandlers {
  return {
    create_worktree: vi.fn(),
    cleanup_worktree: vi.fn(),
    invoke_bmad_command: vi.fn(),
    query_session_history: vi.fn(async () => ({ interactions: [{ t: 1 }] })),
    commit_anchor: vi.fn(),
    remaining_budget: vi.fn(async () => ({ tokensRemaining: 1000 })),
    ...over,
  } as unknown as SupervisorToolHandlers;
}

describe('MultiStepResolutionLoop (EA10-S8)', () => {
  it('accepts high-confidence LLM answer and ends in idle', async () => {
    const states: ResolutionState[] = [];
    const loop = new MultiStepResolutionLoop(
      makeSupervisor({ answer: 'c', escalated: false, durationMs: 10 }),
      makeTools(),
      { logger: ({ nextState }) => states.push(nextState) },
    );
    const result = await loop.resolve(
      { currentQuestion: 'Continue?', workflowCommand: '/x', storyId: 'EA10-S8' },
      makeContext(),
    );
    expect(result.escalated).toBe(false);
    expect(result.finalState).toBe('idle');
    expect(states).toContain('deterministic');
    expect(states).toContain('idle');
  });

  it('consult + synthesize succeeds when tools return non-errored outputs', async () => {
    const loop = new MultiStepResolutionLoop(
      makeSupervisor({
        answer: '',
        escalated: true,
        escalationReason: 'unsure',
        durationMs: 30,
      }),
      makeTools(), // history + budget both non-error → synth = 2/2 = 1.0
    );
    const result = await loop.resolve(
      { currentQuestion: 'x', workflowCommand: '/x', storyId: 'EA10-S8' },
      makeContext(),
    );
    expect(result.finalState).toBe('idle');
    expect(result.escalated).toBe(false);
  });

  it('escalates when synthesis confidence below threshold', async () => {
    const loop = new MultiStepResolutionLoop(
      makeSupervisor({
        answer: '',
        escalated: true,
        escalationReason: 'LLM gave up',
        durationMs: 30,
      }),
      makeTools({
        query_session_history: vi.fn(async () => ({ interactions: [] })),
        remaining_budget: vi.fn(async () => {
          throw new Error('budget service down');
        }),
      }),
    );
    const result = await loop.resolve(
      { currentQuestion: 'x', workflowCommand: '/x', storyId: 'EA10-S8' },
      makeContext(),
    );
    expect(result.escalated).toBe(true);
    expect(result.finalState).toBe('escalated');
    expect(result.escalationReason).toBe('LLM gave up');
  });

  it('threshold overrides are respected', async () => {
    const loop = new MultiStepResolutionLoop(
      makeSupervisor({ answer: 'ok', escalated: false, durationMs: 5 }),
      makeTools(),
      { confidence: { llm: 0.99, synthesis: 0.99 } },
    );
    // LLM confidence is 0.9, below 0.99 threshold → advances to consult
    const result = await loop.resolve(
      { currentQuestion: 'x', workflowCommand: '/x', storyId: 'EA10-S8' },
      makeContext(),
    );
    // synthesis with 2 non-errored outputs = 1.0 ≥ 0.99 → accepted
    expect(result.finalState).toBe('idle');
    expect(result.escalated).toBe(false);
  });

  it('emits transition logs with confidence and note', async () => {
    const events: Array<{ state: ResolutionState; nextState: ResolutionState; note?: string }> = [];
    const loop = new MultiStepResolutionLoop(
      makeSupervisor({ answer: 'c', escalated: false, durationMs: 10 }),
      makeTools(),
      { logger: (e) => events.push(e) },
    );
    await loop.resolve(
      { currentQuestion: 'Continue?', workflowCommand: '/x', storyId: 'EA10-S8' },
      makeContext(),
    );
    const accepted = events.find((e) => e.note === 'accepted');
    expect(accepted).toBeDefined();
  });
});
