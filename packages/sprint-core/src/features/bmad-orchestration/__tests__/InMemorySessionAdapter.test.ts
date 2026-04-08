import { describe, expect, it } from 'vitest';
import type { BMADSessionContext, SessionTurnResult } from '../domain/ports/BMADSessionPort.js';
import { InMemorySessionAdapter } from '../infrastructure/InMemorySessionAdapter.js';

function makeContext(overrides: Partial<BMADSessionContext> = {}): BMADSessionContext {
  return {
    projectPath: '/tmp/test-project',
    storyId: 'EA9-TEST',
    ...overrides,
  };
}

function makeTurn(overrides: Partial<SessionTurnResult> = {}): SessionTurnResult {
  return {
    completed: false,
    output: 'turn output',
    durationMs: 100,
    ...overrides,
  };
}

describe('InMemorySessionAdapter', () => {
  it('should return first scripted turn on startSession', async () => {
    const adapter = new InMemorySessionAdapter([
      makeTurn({ output: 'first turn', completed: false }),
      makeTurn({ output: 'second turn', completed: true }),
    ]);

    const handle = await adapter.startSession('/dev-story', makeContext());

    expect(handle.sessionId).toBeDefined();
    expect(typeof handle.sessionId).toBe('string');
    expect(handle.firstTurn.output).toBe('first turn');
    expect(handle.firstTurn.completed).toBe(false);
  });

  it('should return subsequent scripted turns on continueSession', async () => {
    const adapter = new InMemorySessionAdapter([
      makeTurn({ output: 'first', completed: false }),
      makeTurn({ output: 'second', completed: false }),
      makeTurn({ output: 'third', completed: true }),
    ]);

    const handle = await adapter.startSession('/test', makeContext());
    expect(handle.firstTurn.output).toBe('first');

    const second = await adapter.continueSession(handle.sessionId, 'continue');
    expect(second.output).toBe('second');
    expect(second.completed).toBe(false);

    const third = await adapter.continueSession(handle.sessionId, 'finish');
    expect(third.output).toBe('third');
    expect(third.completed).toBe(true);
  });

  it('should return error turn when all scripted turns are exhausted', async () => {
    const adapter = new InMemorySessionAdapter([
      makeTurn({ output: 'only turn', completed: true }),
    ]);

    const handle = await adapter.startSession('/test', makeContext());
    expect(handle.firstTurn.output).toBe('only turn');

    const extra = await adapter.continueSession(handle.sessionId, 'unexpected');
    expect(extra.completed).toBe(true);
    expect(extra.error).toBe(true);
    expect(extra.errorMessage).toContain('No more scripted turns');
  });

  it('should return error SessionTurnResult scripted turns', async () => {
    const adapter = new InMemorySessionAdapter([
      makeTurn({
        output: 'SDK crash',
        completed: true,
        error: true,
        errorMessage: 'Connection lost',
      }),
    ]);

    const handle = await adapter.startSession('/test', makeContext());
    expect(handle.firstTurn.error).toBe(true);
    expect(handle.firstTurn.errorMessage).toBe('Connection lost');
    expect(handle.firstTurn.completed).toBe(true);
  });

  it('should generate unique sessionId per startSession call', async () => {
    const turns = [makeTurn({ completed: true })];
    const adapter1 = new InMemorySessionAdapter(turns);
    const adapter2 = new InMemorySessionAdapter(turns);

    const handle1 = await adapter1.startSession('/test', makeContext());
    const handle2 = await adapter2.startSession('/test', makeContext());

    expect(handle1.sessionId).not.toBe(handle2.sessionId);
  });
});
