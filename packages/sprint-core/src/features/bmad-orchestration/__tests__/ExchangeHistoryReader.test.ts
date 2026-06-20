import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExchangeHistoryReader } from '../infrastructure/ExchangeHistoryReader.js';
import { ExchangeHistoryWriter } from '../infrastructure/ExchangeHistoryWriter.js';

describe('ExchangeHistoryReader', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'exchange-reader-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function seed(
    writer: ExchangeHistoryWriter,
    over: {
      sessionId?: string;
      storyId?: string;
      startedAt?: string;
    } = {},
  ): Promise<void> {
    await writer.write({
      frontMatter: {
        sessionId: over.sessionId ?? 'sess-1',
        storyId: over.storyId ?? 'EA11-S8',
        sprintId: 'sprint-12',
        command: '/bmad-bmm-dev-story',
        startedAt: over.startedAt ?? '2026-04-14T18:00:00.000Z',
        endedAt: '2026-04-14T18:05:00.000Z',
        supervisorTurns: 1,
        status: 'success',
      },
      interactions: [],
    });
  }

  it('lists all exchange files in chronological order', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    await seed(writer, { startedAt: '2026-04-14T18:00:00.000Z' });
    await seed(writer, { startedAt: '2026-04-14T19:00:00.000Z', sessionId: 'sess-2' });
    const reader = new ExchangeHistoryReader(dir);
    const all = await reader.listAll();
    expect(all).toHaveLength(2);
    const first = all[0];
    const second = all[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.frontMatter.startedAt < second!.frontMatter.startedAt).toBe(true);
  });

  it('filters by sessionId', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    await seed(writer, { sessionId: 'sess-a' });
    await seed(writer, { sessionId: 'sess-b', startedAt: '2026-04-14T19:00:00.000Z' });
    const reader = new ExchangeHistoryReader(dir);
    const out = await reader.bySession('sess-a');
    expect(out).toHaveLength(1);
    expect(out[0]?.frontMatter.sessionId).toBe('sess-a');
  });

  it('filters by storyId', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    await seed(writer, { storyId: 'EA11-S8' });
    await seed(writer, { storyId: 'EA11-S1', startedAt: '2026-04-14T19:00:00.000Z' });
    const reader = new ExchangeHistoryReader(dir);
    const out = await reader.byStory('EA11-S1');
    expect(out).toHaveLength(1);
    expect(out[0]?.frontMatter.storyId).toBe('EA11-S1');
  });

  it('returns empty list when history dir missing', async () => {
    const reader = new ExchangeHistoryReader(dir);
    const out = await reader.listAll();
    expect(out).toEqual([]);
  });
});
