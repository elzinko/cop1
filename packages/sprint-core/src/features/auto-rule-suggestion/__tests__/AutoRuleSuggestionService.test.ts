import { beforeEach, describe, expect, it } from 'vitest';
import { AutoRuleSuggestionService } from '../application/AutoRuleSuggestionService.js';
import type { SprintMetricsSnapshot } from '../application/AutoRuleSuggestionService.js';

describe('AutoRuleSuggestionService', () => {
  let service: AutoRuleSuggestionService;

  beforeEach(() => {
    service = new AutoRuleSuggestionService();
  });

  it('should suggest blocage prevention when blocage rate is high', () => {
    const metrics: SprintMetricsSnapshot = {
      velocity: 20,
      blocageRate: 0.4,
      dodRejectionRate: 0.1,
      coveragePercent: 90,
    };

    const suggestions = service.analyze(metrics);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.description).toBe('Add blocage prevention review');
    expect(suggestions[0]?.priority).toBe('high');
  });

  it('should suggest increasing coverage when coverage is low', () => {
    const metrics: SprintMetricsSnapshot = {
      velocity: 20,
      blocageRate: 0.1,
      dodRejectionRate: 0.1,
      coveragePercent: 60,
    };

    const suggestions = service.analyze(metrics);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.description).toBe('Increase coverage threshold');
  });

  it('should return no suggestions when all metrics are good', () => {
    const metrics: SprintMetricsSnapshot = {
      velocity: 25,
      blocageRate: 0.1,
      dodRejectionRate: 0.1,
      coveragePercent: 95,
    };

    const suggestions = service.analyze(metrics);
    expect(suggestions).toHaveLength(0);
  });

  it('should return multiple suggestions when multiple thresholds are breached', () => {
    const metrics: SprintMetricsSnapshot = {
      velocity: 10,
      blocageRate: 0.5,
      dodRejectionRate: 0.3,
      coveragePercent: 50,
    };

    const suggestions = service.analyze(metrics);
    expect(suggestions).toHaveLength(3);
    const descriptions = suggestions.map((s) => s.description);
    expect(descriptions).toContain('Add blocage prevention review');
    expect(descriptions).toContain('Strengthen DoR validation');
    expect(descriptions).toContain('Increase coverage threshold');
  });
});
