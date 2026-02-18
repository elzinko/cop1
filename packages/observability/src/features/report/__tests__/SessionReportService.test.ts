import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionReportService } from '../application/SessionReportService.js';

describe('SessionReportService', () => {
  let testDir: string;
  let service: SessionReportService;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-report-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(join(testDir, '.cop1'), { recursive: true });
    service = new SessionReportService();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should generate a markdown report from JSONL logs', () => {
    const logLines = [
      JSON.stringify({
        timestamp: '2026-02-18T10:00:00Z',
        eventType: 'story.workflow.started',
        storyId: 'E1-S1',
      }),
      JSON.stringify({
        timestamp: '2026-02-18T10:01:00Z',
        eventType: 'story.step.completed',
        storyId: 'E1-S1',
        step: 'dev',
      }),
      JSON.stringify({
        timestamp: '2026-02-18T10:02:00Z',
        eventType: 'story.step.completed',
        storyId: 'E1-S1',
        step: 'reviewer',
      }),
      JSON.stringify({
        timestamp: '2026-02-18T10:03:00Z',
        eventType: 'story.workflow.completed',
        storyId: 'E1-S1',
      }),
    ].join('\n');

    writeFileSync(join(testDir, '.cop1', 'sprint-log-2026-02-18.jsonl'), logLines);

    const reportPath = service.generate(testDir, '2026-02-18');

    expect(existsSync(reportPath)).toBe(true);
    const report = readFileSync(reportPath, 'utf-8');
    expect(report).toContain('# Session Report');
    expect(report).toContain('Stories completed: 1');
    expect(report).toContain('E1-S1');
  });

  it('should include failed stories in blockers section', () => {
    const logLines = [
      JSON.stringify({
        timestamp: '2026-02-18T10:00:00Z',
        eventType: 'story.workflow.failed',
        storyId: 'E2-S1',
        failedStep: 'reviewer',
      }),
    ].join('\n');

    writeFileSync(join(testDir, '.cop1', 'sprint-log-2026-02-18.jsonl'), logLines);

    const reportPath = service.generate(testDir, '2026-02-18');
    const report = readFileSync(reportPath, 'utf-8');

    expect(report).toContain('## Blockers');
    expect(report).toContain('E2-S1');
  });

  it('should generate report even without log file', () => {
    const reportPath = service.generate(testDir, '2026-02-18');

    expect(existsSync(reportPath)).toBe(true);
    const report = readFileSync(reportPath, 'utf-8');
    expect(report).toContain('Total events: 0');
  });
});
