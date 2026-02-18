import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RoundTableEngine } from '../../round-table/application/RoundTableEngine.js';
import type { RoundTableParticipant } from '../../round-table/domain/RoundTableTypes.js';
import type { CeremonyReport, CeremonyTypeValue } from '../domain/CeremonyTypes.js';

export class ScrumMasterAgent {
  private readonly roundTable: RoundTableEngine;

  constructor(
    private readonly projectPath: string,
    roundTable?: RoundTableEngine,
  ) {
    this.roundTable = roundTable ?? new RoundTableEngine();
  }

  async facilitate(
    ceremonyType: CeremonyTypeValue,
    topic: string,
    participants: RoundTableParticipant[],
  ): Promise<CeremonyReport> {
    const startedAt = new Date().toISOString();

    const result = await this.roundTable.run(topic, participants);

    const report: CeremonyReport = {
      ceremonyType,
      startedAt,
      completedAt: new Date().toISOString(),
      participants: participants.map((p) => p.name),
      summary: result.synthesis,
      decisions: result.consensus
        ? [`Consensus reached: ${result.synthesis.split('\n')[0] ?? ''}`]
        : ['No consensus — escalated for manual review'],
    };

    this.persistReport(ceremonyType, report);

    return report;
  }

  private persistReport(type: CeremonyTypeValue, report: CeremonyReport): void {
    const dir =
      type === 'retrospective'
        ? join(this.projectPath, '.cop1', 'retro-reports')
        : join(this.projectPath, '.cop1', 'ceremonies');

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${type}-${timestamp}.md`;
    const content = this.formatReport(report);

    writeFileSync(join(dir, filename), content, 'utf-8');
  }

  private formatReport(report: CeremonyReport): string {
    return `# ${report.ceremonyType.charAt(0).toUpperCase() + report.ceremonyType.slice(1)} Report

**Started:** ${report.startedAt}
**Completed:** ${report.completedAt}
**Participants:** ${report.participants.join(', ')}

## Summary

${report.summary}

## Decisions

${report.decisions.map((d) => `- ${d}`).join('\n')}
`;
  }
}
