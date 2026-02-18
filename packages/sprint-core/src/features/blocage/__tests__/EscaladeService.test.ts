import { describe, expect, it } from 'vitest';
import { EscaladeService } from '../application/EscaladeService.js';
import type { BlocageTypeValue } from '../domain/Blocage.js';

describe('EscaladeService', () => {
  const cases: [BlocageTypeValue, string][] = [
    ['ambiguity', 'architect'],
    ['missing-access', 'developer'],
    ['missing-dependency', 'developer'],
    ['technical', 'scrum-master'],
    ['timeout', 'pm'],
  ];

  it.each(cases)('should route %s blocage to %s', (type, expectedAgent) => {
    const service = new EscaladeService();
    expect(service.route(type)).toBe(expectedAgent);
  });

  it('should allow custom routing overrides', () => {
    const service = new EscaladeService({ timeout: 'architect' });
    expect(service.route('timeout')).toBe('architect');
    // Others still default
    expect(service.route('ambiguity')).toBe('architect');
  });

  it('should fall back to developer for unknown type', () => {
    const service = new EscaladeService();
    expect(service.route('unknown-type' as BlocageTypeValue)).toBe('developer');
  });

  it('should support updateRouting for hot-reload', () => {
    const service = new EscaladeService();
    expect(service.route('timeout')).toBe('pm');

    service.updateRouting({ timeout: 'scrum-master' });
    expect(service.route('timeout')).toBe('scrum-master');
  });
});
