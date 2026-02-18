export interface SprintMetricsSnapshot {
  velocity: number;
  blocageRate: number;
  dodRejectionRate: number;
  coveragePercent: number;
}

export interface RuleSuggestion {
  suggestedRuleId: string;
  description: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

export class AutoRuleSuggestionService {
  analyze(metrics: SprintMetricsSnapshot): RuleSuggestion[] {
    const suggestions: RuleSuggestion[] = [];

    if (metrics.blocageRate > 0.3) {
      suggestions.push({
        suggestedRuleId: 'blocage-prevention-review',
        description: 'Add blocage prevention review',
        reason: `Blocage rate ${(metrics.blocageRate * 100).toFixed(0)}% exceeds 30% threshold`,
        priority: 'high',
      });
    }

    if (metrics.dodRejectionRate > 0.2) {
      suggestions.push({
        suggestedRuleId: 'strengthen-dor-validation',
        description: 'Strengthen DoR validation',
        reason: `DoD rejection rate ${(metrics.dodRejectionRate * 100).toFixed(0)}% exceeds 20% threshold`,
        priority: 'medium',
      });
    }

    if (metrics.coveragePercent < 80) {
      suggestions.push({
        suggestedRuleId: 'increase-coverage-threshold',
        description: 'Increase coverage threshold',
        reason: `Coverage ${metrics.coveragePercent}% is below 80% target`,
        priority: 'medium',
      });
    }

    return suggestions;
  }
}
