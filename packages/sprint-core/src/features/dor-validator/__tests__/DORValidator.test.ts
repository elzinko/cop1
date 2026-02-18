import { describe, expect, it } from 'vitest';
import type { StorySnapshot } from '../application/DORValidator.js';
import { DORValidator } from '../application/DORValidator.js';

function createSnapshot(overrides: Partial<StorySnapshot> = {}): StorySnapshot {
  return {
    id: 'E1-S1',
    title: 'Test Story',
    acceptanceCriteria: ['AC1', 'AC2'],
    effortEstimate: 5,
    dependencies: [],
    teamCompetencies: ['typescript', 'testing'],
    requiredCompetencies: ['typescript'],
    infraAccess: ['git', 'ollama'],
    requiredAccess: ['git'],
    ...overrides,
  };
}

describe('DORValidator', () => {
  const validator = new DORValidator();

  it('should pass when all dimensions are satisfied', () => {
    const result = validator.validate(createSnapshot());
    expect(result.passed).toBe(true);
    expect(result.dimensions).toHaveLength(3);
    expect(result.dimensions.every((d) => d.passed)).toBe(true);
  });

  it('should fail story quality when no effort estimate', () => {
    const result = validator.validate(createSnapshot({ effortEstimate: null }));
    expect(result.passed).toBe(false);
    const storyDim = result.dimensions.find((d) => d.name === 'story_quality');
    expect(storyDim?.passed).toBe(false);
    expect(storyDim?.missing).toContain('effort_estimate');
  });

  it('should fail team readiness when missing competency', () => {
    const result = validator.validate(
      createSnapshot({ requiredCompetencies: ['rust'], teamCompetencies: ['typescript'] }),
    );
    expect(result.passed).toBe(false);
    const teamDim = result.dimensions.find((d) => d.name === 'team_readiness');
    expect(teamDim?.passed).toBe(false);
    expect(teamDim?.missing).toContain('competency:rust');
  });

  it('should fail infra access when missing access', () => {
    const result = validator.validate(
      createSnapshot({ requiredAccess: ['docker'], infraAccess: ['git'] }),
    );
    expect(result.passed).toBe(false);
    const infraDim = result.dimensions.find((d) => d.name === 'infra_access');
    expect(infraDim?.passed).toBe(false);
    expect(infraDim?.missing).toContain('access:docker');
  });
});
