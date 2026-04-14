import { EventBus } from '@cop1/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { HistoryService } from '../application/HistoryService.js';
import type { SessionHistoryReader } from '../application/SessionHistoryReader.js';
import type { SessionInteraction, SessionLogger } from '../application/SessionLogger.js';

function sampleInteraction(over: Partial<SessionInteraction> = {}): SessionInteraction {
  return {
    timestamp: '2026-04-14T18:00:00.000Z',
    sessionId: 'sess-1',
    storyId: 'EA11-S3',
    epicId: 'EA11',
    workflowCommand: '/bmad-bmm-dev-story',
    turn: 1,
    role: 'supervisor',
    content: 'Proceed',
    analysis: { type: 'question_simple', method: 'deterministic' },
    durationMs: 10,
    ...over,
  };
}

describe('HistoryService', () => {
  it('recordExchange forwards to SessionLogger', () => {
    const logger = { logInteraction: vi.fn() } as unknown as SessionLogger;
    const reader = {} as SessionHistoryReader;
    const svc = new HistoryService(logger, reader);

    svc.recordExchange(sampleInteraction());
    expect(logger.logInteraction).toHaveBeenCalledTimes(1);
  });

  it('recordExchange emits history.exchange.recorded when EventBus provided', () => {
    const logger = { logInteraction: vi.fn() } as unknown as SessionLogger;
    const reader = {} as SessionHistoryReader;
    const bus = new EventBus();
    const captured: unknown[] = [];
    bus.on('history.exchange.recorded', (p: unknown) => captured.push(p));

    const svc = new HistoryService(logger, reader, bus);
    svc.recordExchange(sampleInteraction());

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ sessionId: 'sess-1', storyId: 'EA11-S3', turn: 1 });
  });

  it('byStory delegates to SessionHistoryReader', async () => {
    const interactions = [sampleInteraction()];
    const logger = {} as SessionLogger;
    const reader = {
      getHistoryForStory: vi.fn(async () => interactions),
    } as unknown as SessionHistoryReader;
    const svc = new HistoryService(logger, reader);

    const out = await svc.byStory('EA11-S3');
    expect(out).toBe(interactions);
    expect(reader.getHistoryForStory).toHaveBeenCalledWith('EA11-S3');
  });

  it('bySession filters getRecentHistory by sessionId', async () => {
    const a = sampleInteraction({ sessionId: 'sess-1' });
    const b = sampleInteraction({ sessionId: 'sess-2' });
    const logger = {} as SessionLogger;
    const reader = {
      getRecentHistory: vi.fn(async () => [a, b]),
    } as unknown as SessionHistoryReader;
    const svc = new HistoryService(logger, reader);

    const out = await svc.bySession('sess-2');
    expect(out).toEqual([b]);
  });
});
