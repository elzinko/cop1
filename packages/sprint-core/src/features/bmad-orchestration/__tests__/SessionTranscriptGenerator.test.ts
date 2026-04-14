import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionTranscriptGenerator } from '../application/SessionTranscriptGenerator.js';
import { ExchangeHistoryReader } from '../infrastructure/ExchangeHistoryReader.js';
import { ExchangeHistoryWriter } from '../infrastructure/ExchangeHistoryWriter.js';

async function seed(
  writer: ExchangeHistoryWriter,
  sessionId: string,
  startedAt: string,
  command: string,
): Promise<void> {
  await writer.write({
    frontMatter: {
      sessionId,
      storyId: 'EA11-S7',
      sprintId: 'sprint-12',
      command,
      startedAt,
      endedAt: startedAt,
      supervisorTurns: 1,
      status: 'success',
    },
    interactions: [
      {
        timestamp: startedAt,
        sessionId,
        storyId: 'EA11-S7',
        epicId: 'EA11',
        workflowCommand: command,
        turn: 1,
        role: 'supervisor',
        content: `Answer for ${command}`,
        analysis: { type: 'question_simple', method: 'deterministic' },
        durationMs: 5,
      },
    ],
  });
}

describe('SessionTranscriptGenerator', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'transcript-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('produces transcript with header, sections, and footer', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    await seed(writer, 'sess-1', '2026-04-14T18:00:00.000Z', '/bmad-bmm-create-story');
    await seed(writer, 'sess-1', '2026-04-14T19:00:00.000Z', '/bmad-bmm-dev-story');
    const generator = new SessionTranscriptGenerator(new ExchangeHistoryReader(dir));

    const md = await generator.generate('sess-1');

    expect(md).toContain('# Session transcript — sess-1');
    expect(md).toContain('**Story:** EA11-S7');
    expect(md).toContain('## /bmad-bmm-create-story (2026-04-14T18:00:00.000Z)');
    expect(md).toContain('## /bmad-bmm-dev-story (2026-04-14T19:00:00.000Z)');
    expect(md).toContain('## Source files');
    // create-story section appears before dev-story (chronological sort)
    expect(md.indexOf('/bmad-bmm-create-story')).toBeLessThan(
      md.indexOf('/bmad-bmm-dev-story (2026'),
    );
  });

  it('throws when no files match sessionId', async () => {
    const generator = new SessionTranscriptGenerator(new ExchangeHistoryReader(dir));
    await expect(generator.generate('missing')).rejects.toThrow(
      'No transcript data for session missing',
    );
  });

  it('is deterministic across regenerations', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    await seed(writer, 'sess-det', '2026-04-14T18:00:00.000Z', '/bmad-bmm-dev-story');
    const generator = new SessionTranscriptGenerator(new ExchangeHistoryReader(dir));
    const a = await generator.generate('sess-det');
    const b = await generator.generate('sess-det');
    expect(a).toBe(b);
  });
});
