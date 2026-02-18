import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LogEntry } from '../../logger/application/StructuredLogger.js';
import { JSONLReader } from '../infrastructure/JSONLReader.js';

export class SessionReportService {
  private readonly jsonlReader: JSONLReader;

  constructor() {
    this.jsonlReader = new JSONLReader();
  }

  generate(projectPath: string, sessionDate: string): string {
    const logFile = join(projectPath, '.cop1', `sprint-log-${sessionDate}.jsonl`);
    const entries = this.jsonlReader.read(logFile);

    const report = this.buildReport(entries, sessionDate);

    const reportsDir = join(projectPath, '.cop1', 'reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    const time = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
    const reportPath = join(reportsDir, `${sessionDate}-${time}-session.md`);
    writeFileSync(reportPath, report, 'utf-8');

    return reportPath;
  }

  private buildReport(entries: LogEntry[], date: string): string {
    const storiesCompleted = entries
      .filter((e) => e.eventType === 'story.workflow.completed')
      .map((e) => e.storyId as string)
      .filter(Boolean);

    const storiesFailed = entries
      .filter((e) => e.eventType === 'story.workflow.failed')
      .map((e) => ({ storyId: e.storyId as string, step: e.failedStep as string }));

    const stepsCompleted = entries.filter((e) => e.eventType === 'story.step.completed').length;
    const totalEvents = entries.length;

    const lines: string[] = [
      `# Session Report — ${date}`,
      '',
      '## Summary',
      '',
      `- Total events: ${totalEvents}`,
      `- Steps completed: ${stepsCompleted}`,
      `- Stories completed: ${storiesCompleted.length}`,
      `- Stories failed: ${storiesFailed.length}`,
      '',
    ];

    if (storiesCompleted.length > 0) {
      lines.push('## Stories Completed', '');
      for (const id of storiesCompleted) {
        lines.push(`- ${id}`);
      }
      lines.push('');
    }

    if (storiesFailed.length > 0) {
      lines.push('## Blockers', '');
      for (const { storyId, step } of storiesFailed) {
        lines.push(`- ${storyId} (failed at: ${step})`);
      }
      lines.push('');
    }

    lines.push('## Metrics', '');
    lines.push(`- Log entries: ${totalEvents}`);
    lines.push(`- Steps executed: ${stepsCompleted}`);
    lines.push('');

    return lines.join('\n');
  }
}
