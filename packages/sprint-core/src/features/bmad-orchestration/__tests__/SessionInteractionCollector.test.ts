import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StructuredLogger } from '@cop1/observability';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SessionInteraction } from '../application/SessionLogger.js';
import { SessionInteractionCollector } from '../application/SessionInteractionCollector.js';

function interaction(turn: number): SessionInteraction {
  return {
    timestamp: new Date().toISOString(),
    sessionId: 'sess-1',
    storyId: 'EA14-S2',
    epicId: 'EA14',
    workflowCommand: '/bmad-bmm-dev-story',
    turn,
    role: 'supervisor',
    content: `answer ${turn}`,
    analysis: { type: 'question_simple', method: 'deterministic' },
    durationMs: 10,
  };
}

describe('SessionInteractionCollector', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'collector-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('collects interactions via logInteraction and returns them via drain', () => {
    const logger = new StructuredLogger(dir);
    const collector = new SessionInteractionCollector(logger);

    collector.logInteraction(interaction(1));
    collector.logInteraction(interaction(2));

    const drained = collector.drain();
    expect(drained).toHaveLength(2);
    expect(drained[0]!.turn).toBe(1);
    expect(drained[1]!.turn).toBe(2);
  });

  it('drain clears the buffer', () => {
    const logger = new StructuredLogger(dir);
    const collector = new SessionInteractionCollector(logger);

    collector.logInteraction(interaction(1));
    expect(collector.drain()).toHaveLength(1);
    expect(collector.drain()).toHaveLength(0);
  });

  it('drain returns empty array when no interactions logged', () => {
    const logger = new StructuredLogger(dir);
    const collector = new SessionInteractionCollector(logger);

    expect(collector.drain()).toHaveLength(0);
  });
});
