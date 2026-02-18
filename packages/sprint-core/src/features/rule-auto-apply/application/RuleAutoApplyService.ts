import type { EventBus } from '@cop1/shared-kernel';
import type { ImprovementDecision } from '../../improvement-persistence/application/ImprovementPersistenceService.js';

const RULE_TYPES = new Set(['architecture-rule', 'team', 'quality']);

export class RuleAutoApplyService {
  constructor(private readonly eventBus: EventBus) {}

  autoApply(
    decision: ImprovementDecision,
    applyFn: (ruleId: string, description: string, ruleType: string) => void,
  ): boolean {
    if (decision.status !== 'approved') {
      return false;
    }

    if (!RULE_TYPES.has(decision.type)) {
      return false;
    }

    applyFn(decision.id, decision.description, decision.type);

    this.eventBus.emit('rule.auto-applied', {
      decisionId: decision.id,
      type: decision.type,
      description: decision.description,
    });

    return true;
  }
}
