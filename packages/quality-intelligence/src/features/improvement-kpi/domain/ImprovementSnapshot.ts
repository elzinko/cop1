export interface ImprovementSnapshot {
  totalProposed: number;
  totalApproved: number;
  totalApplied: number;
  refactoringsCompleted: number;
  refactoringsTotal: number;
}

export interface ImprovementKPIs {
  adoptionRate: number;
  applicationRate: number;
  refactoringCompletionRate: number;
  overallEffectiveness: number;
}
