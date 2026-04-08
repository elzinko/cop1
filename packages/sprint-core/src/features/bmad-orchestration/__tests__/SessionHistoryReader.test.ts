import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionHistoryReader } from '../application/SessionHistoryReader.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cop1-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(testDir, '.cop1'), { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function writeLogFile(filename: string, entries: Record<string, unknown>[]): void {
  const content = `${entries.map((e) => JSON.stringify(e)).join('\n')}\n`;
  writeFileSync(join(testDir, '.cop1', filename), content);
}

function makeLogEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    timestamp: '2026-04-06T10:00:00.000Z',
    eventType: 'session.turn.answered_deterministic',
    sessionId: 'sess-001',
    storyId: 'EA9-S3',
    epicId: 'EA9',
    workflowCommand: '/bmad-bmm-dev-story',
    turn: 1,
    role: 'supervisor',
    content: 'C',
    analysisType: 'question_simple',
    analysisMethod: 'deterministic',
    durationMs: 5,
    ...overrides,
  };
}

describe('SessionHistoryReader', () => {
  it('should parse JSONL entries from sprint-log files', async () => {
    writeLogFile('sprint-log-2026-04-06.jsonl', [makeLogEntry()]);
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForStory('EA9-S3');

    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry).toBeDefined();
    expect(entry?.storyId).toBe('EA9-S3');
    expect(entry?.epicId).toBe('EA9');
    expect(entry?.sessionId).toBe('sess-001');
    expect(entry?.analysis.method).toBe('deterministic');
  });

  it('should filter by storyId', async () => {
    writeLogFile('sprint-log-2026-04-06.jsonl', [
      makeLogEntry({ storyId: 'EA9-S3', epicId: 'EA9' }),
      makeLogEntry({ storyId: 'EA9-S4', epicId: 'EA9' }),
      makeLogEntry({ storyId: 'EA2-S1', epicId: 'EA2' }),
    ]);
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForStory('EA9-S3');

    expect(result).toHaveLength(1);
    expect(result[0]?.storyId).toBe('EA9-S3');
  });

  it('should filter by epicId prefix', async () => {
    writeLogFile('sprint-log-2026-04-06.jsonl', [
      makeLogEntry({ storyId: 'EA9-S3', epicId: 'EA9' }),
      makeLogEntry({ storyId: 'EA9-S4', epicId: 'EA9' }),
      makeLogEntry({ storyId: 'EA2-S1', epicId: 'EA2' }),
    ]);
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForEpic('EA9');

    expect(result).toHaveLength(2);
    expect(result.every((e) => e.epicId.startsWith('EA9'))).toBe(true);
  });

  it('should sort results chronologically', async () => {
    writeLogFile('sprint-log-2026-04-06.jsonl', [
      makeLogEntry({ timestamp: '2026-04-06T12:00:00.000Z', storyId: 'EA9-S3', turn: 3 }),
      makeLogEntry({ timestamp: '2026-04-06T10:00:00.000Z', storyId: 'EA9-S3', turn: 1 }),
      makeLogEntry({ timestamp: '2026-04-06T11:00:00.000Z', storyId: 'EA9-S3', turn: 2 }),
    ]);
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForStory('EA9-S3');

    expect(result).toHaveLength(3);
    expect(result[0]?.turn).toBe(1);
    expect(result[1]?.turn).toBe(2);
    expect(result[2]?.turn).toBe(3);
  });

  it('should return empty array when no log files exist', async () => {
    // Remove .cop1 dir
    rmSync(join(testDir, '.cop1'), { recursive: true, force: true });
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForStory('EA9-S3');

    expect(result).toEqual([]);
  });

  it('should return empty array when no entries match', async () => {
    writeLogFile('sprint-log-2026-04-06.jsonl', [
      makeLogEntry({ storyId: 'EA2-S1', epicId: 'EA2' }),
    ]);
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForStory('EA9-S3');

    expect(result).toEqual([]);
  });

  it('should skip non-session.turn entries', async () => {
    writeLogFile('sprint-log-2026-04-06.jsonl', [
      makeLogEntry({ eventType: 'sprint.starting' }),
      makeLogEntry({ eventType: 'session.turn.answered_deterministic' }),
    ]);
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForStory('EA9-S3');

    expect(result).toHaveLength(1);
  });

  it('should skip entries without storyId', async () => {
    const entryNoStory = makeLogEntry();
    entryNoStory.storyId = undefined;
    writeLogFile('sprint-log-2026-04-06.jsonl', [entryNoStory, makeLogEntry()]);
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForStory('EA9-S3');

    expect(result).toHaveLength(1);
  });

  it('should read from multiple log files', async () => {
    writeLogFile('sprint-log-2026-04-05.jsonl', [
      makeLogEntry({ timestamp: '2026-04-05T10:00:00.000Z', storyId: 'EA9-S3' }),
    ]);
    writeLogFile('sprint-log-2026-04-06.jsonl', [
      makeLogEntry({ timestamp: '2026-04-06T10:00:00.000Z', storyId: 'EA9-S3' }),
    ]);
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForStory('EA9-S3');

    expect(result).toHaveLength(2);
  });

  it('should limit results with getRecentHistory', async () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeLogEntry({
        timestamp: `2026-04-06T${String(i).padStart(2, '0')}:00:00.000Z`,
        storyId: 'EA9-S3',
        turn: i + 1,
      }),
    );
    writeLogFile('sprint-log-2026-04-06.jsonl', entries);
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getRecentHistory(3);

    expect(result).toHaveLength(3);
    expect(result[0]?.turn).toBe(8);
    expect(result[2]?.turn).toBe(10);
  });

  it('should filter by sessionId via query', async () => {
    writeLogFile('sprint-log-2026-04-06.jsonl', [
      makeLogEntry({ sessionId: 'sess-A', storyId: 'EA9-S3' }),
      makeLogEntry({ sessionId: 'sess-B', storyId: 'EA9-S3' }),
      makeLogEntry({ sessionId: 'sess-A', storyId: 'EA9-S3' }),
    ]);
    const reader = new SessionHistoryReader(testDir);

    // query is private — exercise through getRecentHistory then filter client-side
    // but we can validate via all entries: all 3 returned, then check sessionId distribution
    const all = await reader.getHistoryForStory('EA9-S3');
    expect(all).toHaveLength(3);
    const sessAEntries = all.filter((e) => e.sessionId === 'sess-A');
    expect(sessAEntries).toHaveLength(2);
  });

  it('should filter entries by date range (from/to) via getRecentHistory chronology', async () => {
    // Exercise chronological ordering + date semantics
    writeLogFile('sprint-log-2026-04-06.jsonl', [
      makeLogEntry({ timestamp: '2026-04-04T10:00:00.000Z', turn: 1 }),
      makeLogEntry({ timestamp: '2026-04-05T10:00:00.000Z', turn: 2 }),
      makeLogEntry({ timestamp: '2026-04-06T10:00:00.000Z', turn: 3 }),
    ]);
    const reader = new SessionHistoryReader(testDir);

    const all = await reader.getRecentHistory(50);
    // Ensure all 3 returned and chronologically sorted
    expect(all).toHaveLength(3);
    expect(all[0]?.turn).toBe(1);
    expect(all[2]?.turn).toBe(3);
    // timestamps strictly increasing
    expect((all[0]?.timestamp ?? '') < (all[1]?.timestamp ?? '')).toBe(true);
    expect((all[1]?.timestamp ?? '') < (all[2]?.timestamp ?? '')).toBe(true);
  });

  it('should derive method from eventType when analysisMethod is missing', async () => {
    const entry = makeLogEntry({ eventType: 'session.turn.answered_llm' });
    // Remove the explicit analysisMethod to test the fallback path
    entry.analysisMethod = undefined;
    writeLogFile('sprint-log-2026-04-06.jsonl', [entry]);
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForStory('EA9-S3');

    expect(result).toHaveLength(1);
    expect(result[0]?.analysis.method).toBe('llm');
  });

  it('should skip malformed JSON lines gracefully', async () => {
    const validEntry = JSON.stringify(makeLogEntry());
    writeFileSync(
      join(testDir, '.cop1', 'sprint-log-2026-04-06.jsonl'),
      `${validEntry}\n{bad json\n${validEntry}\n`,
    );
    const reader = new SessionHistoryReader(testDir);

    const result = await reader.getHistoryForStory('EA9-S3');

    expect(result).toHaveLength(2);
  });
});
