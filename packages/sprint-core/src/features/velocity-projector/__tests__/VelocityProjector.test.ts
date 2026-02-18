import { beforeEach, describe, expect, it } from 'vitest';
import { VelocityProjector } from '../application/VelocityProjector.js';

describe('VelocityProjector', () => {
  let projector: VelocityProjector;

  beforeEach(() => {
    projector = new VelocityProjector();
  });

  it('should compute a basic projection', () => {
    const result = projector.project([10, 12, 8, 11], 30);

    expect(result.avgVelocity).toBeCloseTo(10.25);
    expect(result.estimatedSprints).toBe(3);
    expect(result.confidence).toBe('medium');
  });

  it('should return low confidence with fewer than 3 sprints', () => {
    const result = projector.project([10, 12], 30);

    expect(result.confidence).toBe('low');
    expect(result.estimatedSprints).toBe(3);
  });

  it('should return high confidence with more than 5 sprints', () => {
    const result = projector.project([10, 12, 8, 11, 9, 13], 20);

    expect(result.confidence).toBe('high');
    expect(result.avgVelocity).toBeCloseTo(10.5);
    expect(result.estimatedSprints).toBe(2);
  });

  it('should return Infinity sprints when velocity is zero', () => {
    const result = projector.project([], 50);

    expect(result.avgVelocity).toBe(0);
    expect(result.estimatedSprints).toBe(Number.POSITIVE_INFINITY);
  });
});
