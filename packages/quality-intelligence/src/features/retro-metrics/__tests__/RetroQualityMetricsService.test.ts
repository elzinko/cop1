import { describe, expect, it } from 'vitest';
import { RetroQualityMetricsService } from '../application/RetroQualityMetricsService.js';

describe('RetroQualityMetricsService', () => {
  const service = new RetroQualityMetricsService();

  it('should compute full adoption metrics', () => {
    const result = service.compute({
      rulesProposed: 5,
      rulesAdopted: 5,
      refactoringsProposed: 3,
      refactoringsCompleted: 3,
    });

    expect(result.ruleAdoptionRate).toBe(1);
    expect(result.refactoringCompletionRate).toBe(1);
    expect(result.improvementScore).toBe(1);
  });

  it('should compute partial adoption metrics', () => {
    const result = service.compute({
      rulesProposed: 10,
      rulesAdopted: 6,
      refactoringsProposed: 4,
      refactoringsCompleted: 2,
    });

    expect(result.ruleAdoptionRate).toBe(0.6);
    expect(result.refactoringCompletionRate).toBe(0.5);
    expect(result.improvementScore).toBe(0.55);
  });

  it('should return zeros when nothing proposed', () => {
    const result = service.compute({
      rulesProposed: 0,
      rulesAdopted: 0,
      refactoringsProposed: 0,
      refactoringsCompleted: 0,
    });

    expect(result.ruleAdoptionRate).toBe(0);
    expect(result.refactoringCompletionRate).toBe(0);
    expect(result.improvementScore).toBe(0);
  });
});
