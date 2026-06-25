import type { DoDContext } from '@cop1/sprint-core';
import { describe, expect, it } from 'vitest';
import type { VerificationGate, VerificationResult } from '../../domain/VerificationGate.js';
import { ReviewVerdictDoDCheck } from '../ReviewVerdictDoDCheck.js';
import { VerificationDoDCheck } from '../VerificationDoDCheck.js';

function ctx(overrides: Partial<DoDContext> = {}): DoDContext {
  return {
    projectRoot: '/tmp/project',
    command: '/bmad-bmm-dev-story',
    storyKey: 'S1',
    agentOutput: '',
    ...overrides,
  };
}

function gate(result: VerificationResult): { gate: VerificationGate; calls: string[] } {
  const calls: string[] = [];
  return {
    gate: {
      async verify(input) {
        calls.push(input.command);
        return result;
      },
    },
    calls,
  };
}

describe('VerificationDoDCheck', () => {
  it('has the stable id "verification"', () => {
    const { gate: g } = gate({ passed: true, summary: 'ok' });
    expect(new VerificationDoDCheck(g).id).toBe('verification');
  });

  it('is satisfied when the gate passes on a verifiable command', async () => {
    const { gate: g, calls } = gate({ passed: true, summary: 'ok' });
    const result = await new VerificationDoDCheck(g).evaluate(
      ctx({ command: '/bmad-bmm-dev-story' }),
    );
    expect(calls).toEqual(['/bmad-bmm-dev-story']);
    expect(result.satisfied).toBe(true);
    expect(result.detail).toBe('ok');
  });

  it('is unsatisfied with the gate summary as detail when the gate fails', async () => {
    const { gate: g } = gate({ passed: false, summary: 'verify failed: pnpm -s test (exit 1)' });
    const result = await new VerificationDoDCheck(g).evaluate(
      ctx({ command: '/bmad-bmm-dev-story' }),
    );
    expect(result.satisfied).toBe(false);
    expect(result.detail).toBe('verify failed: pnpm -s test (exit 1)');
  });

  it('skips (satisfied, gate not called) when the command is not verifiable', async () => {
    const { gate: g, calls } = gate({ passed: false, summary: 'should not run' });
    const result = await new VerificationDoDCheck(g).evaluate(
      ctx({ command: '/bmad-bmm-create-story' }),
    );
    expect(calls).toEqual([]);
    expect(result.satisfied).toBe(true);
  });
});

describe('ReviewVerdictDoDCheck', () => {
  it('has the stable id "review_verdict"', () => {
    expect(new ReviewVerdictDoDCheck().id).toBe('review_verdict');
  });

  it('blocks a code-review whose output requests changes', async () => {
    const result = await new ReviewVerdictDoDCheck().evaluate(
      ctx({
        command: '/bmad-bmm-code-review',
        agentOutput: 'Verdict: FAIL — changes requested.',
      }),
    );
    expect(result.satisfied).toBe(false);
    expect(result.detail).toContain('code-review requested changes');
    expect(result.detail).toContain('Verdict: FAIL');
  });

  it('is satisfied for an approving code-review', async () => {
    const result = await new ReviewVerdictDoDCheck().evaluate(
      ctx({ command: '/bmad-bmm-code-review', agentOutput: 'Verdict: PASS ✅ LGTM.' }),
    );
    expect(result.satisfied).toBe(true);
  });

  it('is satisfied for a non-review command regardless of output', async () => {
    const result = await new ReviewVerdictDoDCheck().evaluate(
      ctx({ command: '/bmad-bmm-dev-story', agentOutput: 'changes requested' }),
    );
    expect(result.satisfied).toBe(true);
  });
});
