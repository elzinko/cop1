import { describe, expect, it } from 'vitest';
import { TimeEstimator } from '../application/TimeEstimator.js';

describe('TimeEstimator', () => {
  const estimator = new TimeEstimator();

  it('should estimate remaining time', () => {
    const now = new Date('2025-01-01T10:00:00Z');
    const deadline = new Date('2025-01-01T18:00:00Z'); // 8h remaining

    const result = estimator.estimate(5, 30, deadline, now);

    expect(result.estimatedRemainingMinutes).toBe(150); // 5 × 30
    expect(result.atRisk).toBe(false); // 150min < 480min
  });

  it('should flag atRisk when not enough time', () => {
    const now = new Date('2025-01-01T17:00:00Z');
    const deadline = new Date('2025-01-01T18:00:00Z'); // 1h remaining

    const result = estimator.estimate(5, 30, deadline, now);

    expect(result.estimatedRemainingMinutes).toBe(150); // 5 × 30 = 150min
    expect(result.atRisk).toBe(true); // 150min > 60min
  });

  it('should not be at risk when no stories remain', () => {
    const now = new Date('2025-01-01T17:30:00Z');
    const deadline = new Date('2025-01-01T18:00:00Z');

    const result = estimator.estimate(0, 30, deadline, now);

    expect(result.estimatedRemainingMinutes).toBe(0);
    expect(result.atRisk).toBe(false);
  });

  it('should include deadline in result', () => {
    const deadline = new Date('2025-06-15T12:00:00Z');
    const result = estimator.estimate(3, 20, deadline, new Date('2025-06-15T10:00:00Z'));

    expect(result.deadline).toBe('2025-06-15T12:00:00.000Z');
  });
});
