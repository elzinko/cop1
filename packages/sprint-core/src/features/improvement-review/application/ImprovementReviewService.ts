import type { ImprovementDecision } from '../../improvement-persistence/application/ImprovementPersistenceService.js';
import { ImprovementPersistenceService } from '../../improvement-persistence/application/ImprovementPersistenceService.js';

export type GroupedImprovements = Record<string, ImprovementDecision[]>;

export class ImprovementReviewService {
  private readonly persistenceService: ImprovementPersistenceService;

  constructor(persistenceService?: ImprovementPersistenceService) {
    this.persistenceService = persistenceService ?? new ImprovementPersistenceService();
  }

  getGrouped(decisions: ImprovementDecision[]): GroupedImprovements {
    const grouped: GroupedImprovements = {};
    for (const decision of decisions) {
      const group = grouped[decision.type] ?? [];
      group.push(decision);
      grouped[decision.type] = group;
    }
    return grouped;
  }

  approve(projectPath: string, id: string): ImprovementDecision | null {
    return this.persistenceService.updateStatus(projectPath, id, 'approved');
  }

  reject(projectPath: string, id: string, _reason: string): ImprovementDecision | null {
    return this.persistenceService.updateStatus(projectPath, id, 'rejected');
  }
}
