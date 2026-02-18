import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { DecisionHistoryService } from '../application/DecisionHistoryService.js';

describe('DecisionHistoryService', () => {
  let testDir: string;
  let service: DecisionHistoryService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-decisions-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    service = new DecisionHistoryService();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should get decisions by story id', () => {
    writeFileSync(
      join(testDir, 'decision-001.yaml'),
      stringify({
        storyId: 'S-001',
        question: 'Which DB?',
        context: 'Backend',
        status: 'answered',
        answer: 'PostgreSQL',
        asked_at: '2026-01-01T00:00:00Z',
      }),
    );
    writeFileSync(
      join(testDir, 'decision-002.yaml'),
      stringify({
        storyId: 'S-002',
        question: 'Framework?',
        context: 'Frontend',
        status: 'pending',
        asked_at: '2026-01-02T00:00:00Z',
      }),
    );

    const results = service.getByStory(testDir, 'S-001');
    expect(results).toHaveLength(1);
    expect(results[0]?.storyId).toBe('S-001');
    expect(results[0]?.answer).toBe('PostgreSQL');
  });

  it('should get all decisions', () => {
    writeFileSync(
      join(testDir, 'decision-001.yaml'),
      stringify({
        storyId: 'S-001',
        question: 'Q1',
        context: 'C1',
        status: 'answered',
        asked_at: '2026-01-01T00:00:00Z',
      }),
    );
    writeFileSync(
      join(testDir, 'decision-002.yaml'),
      stringify({
        storyId: 'S-002',
        question: 'Q2',
        context: 'C2',
        status: 'pending',
        asked_at: '2026-01-02T00:00:00Z',
      }),
    );

    const results = service.getAll(testDir);
    expect(results).toHaveLength(2);
  });

  it('should return empty array when directory does not exist', () => {
    const results = service.getAll('/tmp/nonexistent-dir-cop1-test');
    expect(results).toEqual([]);
  });

  it('should filter by story id correctly', () => {
    writeFileSync(
      join(testDir, 'decision-001.yaml'),
      stringify({
        storyId: 'S-001',
        question: 'Q1',
        context: 'C1',
        status: 'answered',
        asked_at: '2026-01-01T00:00:00Z',
      }),
    );
    writeFileSync(
      join(testDir, 'decision-002.yaml'),
      stringify({
        storyId: 'S-002',
        question: 'Q2',
        context: 'C2',
        status: 'pending',
        asked_at: '2026-01-02T00:00:00Z',
      }),
    );
    writeFileSync(
      join(testDir, 'decision-003.yaml'),
      stringify({
        storyId: 'S-001',
        question: 'Q3',
        context: 'C3',
        status: 'pending',
        asked_at: '2026-01-03T00:00:00Z',
      }),
    );

    const results = service.getByStory(testDir, 'S-001');
    expect(results).toHaveLength(2);
    expect(results.every((d) => d.storyId === 'S-001')).toBe(true);
  });
});
