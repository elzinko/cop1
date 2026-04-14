import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MetricsWriter } from '../infrastructure/MetricsWriter.js';

describe('MetricsWriter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'metrics-writer-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('appends JSONL records with daily rotation', async () => {
    const writer = new MetricsWriter(dir);
    await writer.append({
      ts: '2026-04-14T18:00:00.000Z',
      sessionId: 's1',
      storyId: 'EA11-S8',
      event: 'session.started',
    });
    await writer.append({
      ts: '2026-04-14T18:05:00.000Z',
      sessionId: 's1',
      storyId: 'EA11-S8',
      event: 'session.turn.completed',
      data: { turn: 1 },
    });
    const path = join(dir, '.cop1', 'metrics', '2026-04-14.jsonl');
    const raw = await readFile(path, 'utf-8');
    const lines = raw.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({ event: 'session.started' });
    expect(JSON.parse(lines[1])).toMatchObject({ event: 'session.turn.completed' });
  });

  it('rotates to a new file on a different date', async () => {
    const writer = new MetricsWriter(dir);
    await writer.append({
      ts: '2026-04-14T18:00:00.000Z',
      sessionId: 's1',
      storyId: 'EA11-S8',
      event: 'e1',
    });
    await writer.append({
      ts: '2026-04-15T10:00:00.000Z',
      sessionId: 's1',
      storyId: 'EA11-S8',
      event: 'e2',
    });
    const day1 = await readFile(join(dir, '.cop1', 'metrics', '2026-04-14.jsonl'), 'utf-8');
    const day2 = await readFile(join(dir, '.cop1', 'metrics', '2026-04-15.jsonl'), 'utf-8');
    expect(day1).toContain('"event":"e1"');
    expect(day2).toContain('"event":"e2"');
  });

  it('falls back to today when ts has no date prefix', async () => {
    const writer = new MetricsWriter(dir);
    await writer.append({
      ts: 'not-a-date',
      sessionId: 's1',
      storyId: 'EA11-S8',
      event: 'e',
    });
    const today = new Date().toISOString().slice(0, 10);
    const raw = await readFile(join(dir, '.cop1', 'metrics', `${today}.jsonl`), 'utf-8');
    expect(raw).toContain('"event":"e"');
  });
});
