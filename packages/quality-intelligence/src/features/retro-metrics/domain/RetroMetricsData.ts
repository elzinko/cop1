export interface RetroMetricsData {
  rulesProposed: number;
  rulesAdopted: number;
  refactoringsProposed: number;
  refactoringsCompleted: number;
}

export interface RetroQualityMetrics {
  ruleAdoptionRate: number;
  refactoringCompletionRate: number;
  improvementScore: number;
}
