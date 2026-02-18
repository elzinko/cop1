import type { ImprovementKPIs, ImprovementSnapshot } from '../domain/ImprovementSnapshot.js';

export class ImprovementKPIService {
  computeKPIs(snapshot: ImprovementSnapshot): ImprovementKPIs {
    const adoptionRate =
      snapshot.totalProposed > 0 ? snapshot.totalApproved / snapshot.totalProposed : 0;
    const applicationRate =
      snapshot.totalApproved > 0 ? snapshot.totalApplied / snapshot.totalApproved : 0;
    const refactoringCompletionRate =
      snapshot.refactoringsTotal > 0
        ? snapshot.refactoringsCompleted / snapshot.refactoringsTotal
        : 0;
    const overallEffectiveness = (adoptionRate + applicationRate + refactoringCompletionRate) / 3;

    return {
      adoptionRate,
      applicationRate,
      refactoringCompletionRate,
      overallEffectiveness,
    };
  }
}
