import type { RetroMetricsData, RetroQualityMetrics } from '../domain/RetroMetricsData.js';

export class RetroQualityMetricsService {
  compute(data: RetroMetricsData): RetroQualityMetrics {
    const ruleAdoptionRate = data.rulesProposed > 0 ? data.rulesAdopted / data.rulesProposed : 0;
    const refactoringCompletionRate =
      data.refactoringsProposed > 0 ? data.refactoringsCompleted / data.refactoringsProposed : 0;
    const improvementScore = (ruleAdoptionRate + refactoringCompletionRate) / 2;

    return {
      ruleAdoptionRate,
      refactoringCompletionRate,
      improvementScore,
    };
  }
}
