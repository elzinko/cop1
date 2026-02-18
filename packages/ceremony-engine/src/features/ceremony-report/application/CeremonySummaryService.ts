import type { CeremonyReport } from '../../scrum-master/domain/CeremonyTypes.js';

export class CeremonySummaryService {
  generateSummary(report: CeremonyReport): string {
    const lines: string[] = [
      `# Ceremony Report: ${report.ceremonyType}`,
      '',
      `**Started:** ${report.startedAt}`,
      `**Completed:** ${report.completedAt}`,
      '',
      '## Participants',
      ...report.participants.map((p) => `- ${p}`),
      '',
      '## Summary',
      report.summary,
      '',
      '## Decisions',
      ...report.decisions.map((d) => `- ${d}`),
    ];

    return lines.join('\n');
  }

  generateMultiSummary(reports: CeremonyReport[]): string {
    if (reports.length === 0) {
      return '# Ceremony Reports\n\nNo ceremonies to report.';
    }

    const sections = reports.map((report) => this.generateSummary(report));
    return sections.join('\n\n---\n\n');
  }
}
