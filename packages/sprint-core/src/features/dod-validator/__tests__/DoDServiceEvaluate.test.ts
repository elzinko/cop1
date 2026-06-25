import { describe, expect, it } from 'vitest';
import { DoDService } from '../application/DoDService.js';
import type { DoDCheck, DoDCheckRegistry, DoDCheckResult, DoDContext } from '../domain/DoDCheck.js';

const ctx: DoDContext = {
  projectRoot: '/tmp/project',
  command: '/bmad-bmm-dev-story',
  storyKey: 'S1',
  agentOutput: 'done',
};

function check(id: string, result: DoDCheckResult): DoDCheck {
  return { id, evaluate: async () => result };
}

function registry(...checks: DoDCheck[]): DoDCheckRegistry {
  return new Map(checks.map((c) => [c.id, c]));
}

describe('DoDService.evaluate', () => {
  const service = new DoDService();

  it('passes when every registered criterion is satisfied', async () => {
    const reg = registry(
      check('verification', { satisfied: true }),
      check('review_verdict', { satisfied: true }),
    );

    const result = await service.evaluate(ctx, ['verification', 'review_verdict'], reg);

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('collects failures with their detail', async () => {
    const reg = registry(
      check('verification', { satisfied: false, detail: 'verify failed: pnpm test (exit 1)' }),
      check('review_verdict', { satisfied: true }),
    );

    const result = await service.evaluate(ctx, ['verification', 'review_verdict'], reg);

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual([
      { id: 'verification', detail: 'verify failed: pnpm test (exit 1)' },
    ]);
  });

  it('skips criterion ids absent from the registry (lenient, not a failure)', async () => {
    const reg = registry(check('verification', { satisfied: true }));

    const result = await service.evaluate(ctx, ['verification', 'unknown_criterion'], reg);

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('passes on empty criteria', async () => {
    const result = await service.evaluate(ctx, [], registry());
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });
});
