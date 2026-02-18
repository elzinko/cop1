import { describe, expect, it } from 'vitest';
import { ImprovementKPIService } from '../application/ImprovementKPIService.js';

describe('ImprovementKPIService', () => {
  const service = new ImprovementKPIService();

  it('should compute full effectiveness', () => {
    const result = service.computeKPIs({
      totalProposed: 10,
      totalApproved: 10,
      totalApplied: 10,
      refactoringsCompleted: 5,
      refactoringsTotal: 5,
    });

    expect(result.adoptionRate).toBe(1);
    expect(result.applicationRate).toBe(1);
    expect(result.refactoringCompletionRate).toBe(1);
    expect(result.overallEffectiveness).toBe(1);
  });

  it('should compute partial effectiveness', () => {
    const result = service.computeKPIs({
      totalProposed: 10,
      totalApproved: 6,
      totalApplied: 3,
      refactoringsCompleted: 2,
      refactoringsTotal: 4,
    });

    expect(result.adoptionRate).toBe(0.6);
    expect(result.applicationRate).toBe(0.5);
    expect(result.refactoringCompletionRate).toBe(0.5);
    expect(result.overallEffectiveness).toBeCloseTo(0.5333, 3);
  });

  it('should handle zero values safely', () => {
    const result = service.computeKPIs({
      totalProposed: 0,
      totalApproved: 0,
      totalApplied: 0,
      refactoringsCompleted: 0,
      refactoringsTotal: 0,
    });

    expect(result.adoptionRate).toBe(0);
    expect(result.applicationRate).toBe(0);
    expect(result.refactoringCompletionRate).toBe(0);
    expect(result.overallEffectiveness).toBe(0);
  });
});
