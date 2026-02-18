import { describe, expect, it } from 'vitest';
import type { INVESTSnapshot } from '../application/INVESTValidator.js';
import { INVESTValidator } from '../application/INVESTValidator.js';

function createSnapshot(overrides: Partial<INVESTSnapshot> = {}): INVESTSnapshot {
  return {
    title: 'Good Story',
    description: 'A well-described story with enough detail for implementation',
    acceptanceCriteria: ['AC1', 'AC2'],
    effortEstimate: 5,
    dependencies: [],
    hasTestPlan: true,
    ...overrides,
  };
}

describe('INVESTValidator', () => {
  const validator = new INVESTValidator();

  it('should pass a well-formed story', () => {
    const result = validator.check(createSnapshot());
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.failedCriteria).toHaveLength(0);
  });

  it('should fail Independent when too many dependencies', () => {
    const result = validator.check(createSnapshot({ dependencies: ['A', 'B', 'C', 'D'] }));
    expect(result.failedCriteria).toContain('Independent');
  });

  it('should fail Small when effort exceeds 13', () => {
    const result = validator.check(createSnapshot({ effortEstimate: 21 }));
    expect(result.failedCriteria).toContain('Small');
  });

  it('should fail Estimable when no effort estimate', () => {
    const result = validator.check(createSnapshot({ effortEstimate: null }));
    expect(result.failedCriteria).toContain('Estimable');
  });

  it('should fail Testable when no acceptance criteria', () => {
    const result = validator.check(createSnapshot({ acceptanceCriteria: [] }));
    expect(result.failedCriteria).toContain('Testable');
  });
});
