import { describe, expect, it } from 'vitest';
import type { CeremonyReport } from '../../scrum-master/domain/CeremonyTypes.js';
import { CeremonySummaryService } from '../application/CeremonySummaryService.js';

function makeReport(overrides: Partial<CeremonyReport> = {}): CeremonyReport {
  return {
    ceremonyType: 'planning',
    startedAt: '2026-02-18T10:00:00Z',
    completedAt: '2026-02-18T11:00:00Z',
    participants: ['PM', 'Architect', 'ScrumMaster'],
    summary: 'Sprint goals discussed and aligned.',
    decisions: ['Focus on auth module', 'Skip low-priority bugs'],
    ...overrides,
  };
}

describe('CeremonySummaryService', () => {
  it('should generate a formatted markdown summary for a single report', () => {
    const service = new CeremonySummaryService();
    const report = makeReport();

    const markdown = service.generateSummary(report);

    expect(markdown).toContain('# Ceremony Report: planning');
    expect(markdown).toContain('## Participants');
    expect(markdown).toContain('- PM');
    expect(markdown).toContain('- Architect');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('Sprint goals discussed and aligned.');
    expect(markdown).toContain('## Decisions');
    expect(markdown).toContain('- Focus on auth module');
  });

  it('should generate a combined summary for multiple reports', () => {
    const service = new CeremonySummaryService();
    const reports = [
      makeReport({ ceremonyType: 'planning' }),
      makeReport({ ceremonyType: 'retrospective', summary: 'Retro went well.' }),
    ];

    const markdown = service.generateMultiSummary(reports);

    expect(markdown).toContain('# Ceremony Report: planning');
    expect(markdown).toContain('# Ceremony Report: retrospective');
    expect(markdown).toContain('Retro went well.');
    expect(markdown).toContain('---');
  });

  it('should return header only for empty list', () => {
    const service = new CeremonySummaryService();

    const markdown = service.generateMultiSummary([]);

    expect(markdown).toContain('# Ceremony Reports');
    expect(markdown).toContain('No ceremonies to report.');
  });
});
