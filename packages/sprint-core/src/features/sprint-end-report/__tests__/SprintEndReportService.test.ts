import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SprintReportData } from '../application/SprintEndReportService.js';
import { SprintEndReportService } from '../application/SprintEndReportService.js';

describe('SprintEndReportService', () => {
  let testDir: string;
  let service: SprintEndReportService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-report-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    service = new SprintEndReportService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const reportData: SprintReportData = {
    sprintId: 'sprint-1',
    deliveredStories: [
      { id: 'S1', title: 'Setup', points: 5 },
      { id: 'S2', title: 'Auth', points: 8 },
    ],
    velocity: 13,
    blocagesCount: 1,
    qualityGatePassed: true,
  };

  it('should generate markdown report', () => {
    const { markdown } = service.generate(reportData);

    expect(markdown).toContain('# Sprint Report: sprint-1');
    expect(markdown).toContain('S1: Setup (5 pts)');
    expect(markdown).toContain('Velocity: 13 pts/sprint');
    expect(markdown).toContain('Quality Gate: PASSED');
  });

  it('should persist report to file', () => {
    service.generate(reportData);

    const filePath = join(testDir, '.cop1/sprint-reports/sprint-1.md');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('Sprint Report');
  });

  it('should return JSON with total points', () => {
    const { json } = service.generate(reportData);
    const data = json as Record<string, unknown>;

    expect(data.totalPoints).toBe(13);
    expect(data.sprintId).toBe('sprint-1');
  });

  it('should indicate failed quality gate', () => {
    const { markdown } = service.generate({ ...reportData, qualityGatePassed: false });
    expect(markdown).toContain('Quality Gate: FAILED');
  });
});
