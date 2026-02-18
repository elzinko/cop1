import { describe, expect, it } from 'vitest';
import { ReviewQualityMetricsService } from '../application/ReviewQualityMetricsService.js';

describe('ReviewQualityMetricsService', () => {
  const service = new ReviewQualityMetricsService();

  it('should compute perfect metrics when all reviews are approved', () => {
    const result = service.compute([
      { storyId: 'S-001', approved: true, iterations: 1 },
      { storyId: 'S-002', approved: true, iterations: 1 },
      { storyId: 'S-003', approved: true, iterations: 1 },
    ]);

    expect(result.approvalRate).toBe(1);
    expect(result.reworkRate).toBe(0);
    expect(result.avgIterationsPerStory).toBe(1);
    expect(result.totalReviews).toBe(3);
  });

  it('should compute mixed review metrics', () => {
    const result = service.compute([
      { storyId: 'S-001', approved: true, iterations: 1 },
      { storyId: 'S-002', approved: false, iterations: 3 },
      { storyId: 'S-003', approved: true, iterations: 2 },
      { storyId: 'S-004', approved: false, iterations: 1 },
    ]);

    expect(result.approvalRate).toBe(0.5);
    expect(result.reworkRate).toBe(0.5);
    expect(result.avgIterationsPerStory).toBe(1.75);
    expect(result.totalReviews).toBe(4);
  });

  it('should return zeros for empty reviews', () => {
    const result = service.compute([]);

    expect(result.approvalRate).toBe(0);
    expect(result.reworkRate).toBe(0);
    expect(result.avgIterationsPerStory).toBe(0);
    expect(result.totalReviews).toBe(0);
  });

  it('should detect high rework rate', () => {
    const result = service.compute([
      { storyId: 'S-001', approved: true, iterations: 3 },
      { storyId: 'S-002', approved: true, iterations: 4 },
      { storyId: 'S-003', approved: false, iterations: 5 },
    ]);

    expect(result.reworkRate).toBe(1);
    expect(result.avgIterationsPerStory).toBe(4);
  });
});
