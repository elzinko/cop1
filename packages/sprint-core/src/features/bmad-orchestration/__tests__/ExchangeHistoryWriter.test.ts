import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExchangeRecord } from '../domain/HistoryRecords.js';
import { ExchangeHistoryWriter } from '../infrastructure/ExchangeHistoryWriter.js';

function record(over: Partial<ExchangeRecord> = {}): ExchangeRecord {
  return {
    frontMatter: {
      sessionId: 'sess-1',
      storyId: 'EA11-S8',
      sprintId: 'sprint-12',
      command: '/bmad-bmm-dev-story',
      startedAt: '2026-04-14T18:00:00.000Z',
      endedAt: '2026-04-14T18:05:00.000Z',
      supervisorTurns: 2,
      status: 'success',
      ...(over.frontMatter ?? {}),
    },
    interactions: over.interactions ?? [
      {
        timestamp: '2026-04-14T18:00:00.000Z',
        sessionId: 'sess-1',
        storyId: 'EA11-S8',
        epicId: 'EA11',
        workflowCommand: '/bmad-bmm-dev-story',
        turn: 1,
        role: 'supervisor',
        content: 'Proceed.',
        analysis: { type: 'question_simple', method: 'deterministic' },
        durationMs: 10,
      },
    ],
  };
}

describe('ExchangeHistoryWriter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'exchange-writer-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes a Track 2 markdown file at the expected path', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(record());
    expect(path).toContain(join('.cop1', 'history', 'sprint-12', 'EA11-S8'));
    const content = await readFile(path, 'utf-8');
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('session_id: "sess-1"');
    expect(content).toContain('status: success');
    expect(content).toContain('turn 1 — supervisor (deterministic)');
  });

  it('escapes body content starting with --- via sentinel marker', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(record());
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('<!-- cop1:body-start -->');
  });

  it('sanitizes command slashes in filename', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(record());
    expect(path).not.toContain('/bmad-bmm');
    expect(path).toContain('_bmad-bmm-dev-story');
  });

  it('handles empty interactions gracefully', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(record({ interactions: [] }));
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('_No interactions recorded._');
  });
});
