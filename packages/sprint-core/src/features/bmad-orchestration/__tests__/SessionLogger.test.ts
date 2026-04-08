import type { StructuredLogger } from '@cop1/observability';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type SessionInteraction,
  SessionLogger,
  deriveEpicId,
} from '../application/SessionLogger.js';

function createMockLogger() {
  return { event: vi.fn() } as unknown as Pick<StructuredLogger, 'event'> & {
    event: ReturnType<typeof vi.fn>;
  };
}

function makeInteraction(overrides: Partial<SessionInteraction> = {}): SessionInteraction {
  return {
    timestamp: '2026-04-06T10:00:00.000Z',
    sessionId: 'sess-001',
    storyId: 'EA9-S3',
    epicId: 'EA9',
    workflowCommand: '/bmad-bmm-dev-story',
    turn: 1,
    role: 'supervisor',
    content: 'C',
    analysis: { type: 'question_simple', method: 'deterministic' },
    durationMs: 5,
    ...overrides,
  };
}

describe('deriveEpicId', () => {
  it('should derive epicId from standard storyId', () => {
    expect(deriveEpicId('EA9-S3')).toBe('EA9');
  });

  it('should derive epicId from storyId with letter suffix', () => {
    expect(deriveEpicId('E12-S6b')).toBe('E12');
  });

  it('should derive epicId from storyId with letter suffix variant', () => {
    expect(deriveEpicId('EA2-S0c')).toBe('EA2');
  });

  it('should return storyId as-is when no -S found', () => {
    expect(deriveEpicId('unknown')).toBe('unknown');
  });
});

describe('SessionLogger', () => {
  let eventBus: EventBus;

  afterEach(() => {
    eventBus?.removeAllListeners();
  });

  it('should log interaction with correct event type for deterministic answers', () => {
    const mockLogger = createMockLogger();
    const logger = new SessionLogger(mockLogger as unknown as StructuredLogger);

    const entry = makeInteraction({
      analysis: { type: 'question_simple', method: 'deterministic' },
    });
    logger.logInteraction(entry);

    expect(mockLogger.event).toHaveBeenCalledOnce();
    expect(mockLogger.event).toHaveBeenCalledWith(
      'session.turn.answered_deterministic',
      expect.objectContaining({
        sessionId: 'sess-001',
        storyId: 'EA9-S3',
        epicId: 'EA9',
        turn: 1,
        analysisMethod: 'deterministic',
      }),
    );
  });

  it('should log interaction with correct event type for LLM answers', () => {
    const mockLogger = createMockLogger();
    const logger = new SessionLogger(mockLogger as unknown as StructuredLogger);

    const entry = makeInteraction({
      analysis: { type: 'question_complex', method: 'llm' },
      durationMs: 1500,
      tokensUsed: 200,
    });
    logger.logInteraction(entry);

    expect(mockLogger.event).toHaveBeenCalledWith(
      'session.turn.answered_llm',
      expect.objectContaining({
        analysisMethod: 'llm',
        durationMs: 1500,
        tokensUsed: 200,
      }),
    );
  });

  it('should log interaction with correct event type for escalation', () => {
    const mockLogger = createMockLogger();
    const logger = new SessionLogger(mockLogger as unknown as StructuredLogger);

    const entry = makeInteraction({
      analysis: { type: 'escalation', method: 'escalation' },
      content: 'ESCALATE: Cannot determine story path',
    });
    logger.logInteraction(entry);

    expect(mockLogger.event).toHaveBeenCalledWith(
      'session.turn.escalated',
      expect.objectContaining({ content: 'ESCALATE: Cannot determine story path' }),
    );
  });

  it('should log workflow questions with question_intercepted event type', () => {
    const mockLogger = createMockLogger();
    const logger = new SessionLogger(mockLogger as unknown as StructuredLogger);

    const entry = makeInteraction({ role: 'workflow', content: 'Which story to develop?' });
    logger.logInteraction(entry);

    expect(mockLogger.event).toHaveBeenCalledWith(
      'session.turn.question_intercepted',
      expect.objectContaining({ role: 'workflow', content: 'Which story to develop?' }),
    );
  });

  it('should emit events via EventBus when provided', () => {
    const mockLogger = createMockLogger();
    eventBus = new EventBus();
    const logger = new SessionLogger(mockLogger as never, eventBus);

    const events: { type: string; payload: unknown }[] = [];
    eventBus.on('session.turn.answered_deterministic', (p) =>
      events.push({ type: 'session.turn.answered_deterministic', payload: p }),
    );

    logger.logInteraction(makeInteraction());

    expect(events).toHaveLength(1);
    const payload = events[0]?.payload as Record<string, unknown>;
    expect(payload.sessionId).toBe('sess-001');
    expect(payload.storyId).toBe('EA9-S3');
    expect(payload.epicId).toBe('EA9');
    expect(payload.method).toBe('deterministic');
  });

  it('should not throw when no EventBus provided', () => {
    const mockLogger = createMockLogger();
    const logger = new SessionLogger(mockLogger as unknown as StructuredLogger);

    expect(() => logger.logInteraction(makeInteraction())).not.toThrow();
    expect(mockLogger.event).toHaveBeenCalledOnce();
  });

  it('should include all required fields in log payload', () => {
    const mockLogger = createMockLogger();
    const logger = new SessionLogger(mockLogger as unknown as StructuredLogger);

    logger.logInteraction(makeInteraction());

    const payload = mockLogger.event.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toHaveProperty('sessionId');
    expect(payload).toHaveProperty('storyId');
    expect(payload).toHaveProperty('epicId');
    expect(payload).toHaveProperty('workflowCommand');
    expect(payload).toHaveProperty('turn');
    expect(payload).toHaveProperty('role');
    expect(payload).toHaveProperty('content');
    expect(payload).toHaveProperty('analysisType');
    expect(payload).toHaveProperty('analysisMethod');
    expect(payload).toHaveProperty('durationMs');
  });
});
