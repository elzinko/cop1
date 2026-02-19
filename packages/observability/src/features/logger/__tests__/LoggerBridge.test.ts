import { EventBus } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import { LoggerBridge } from '../application/LoggerBridge.js';
import type { StructuredLogger } from '../application/StructuredLogger.js';

function createMockLogger(): StructuredLogger & {
  entries: { type: string; payload: Record<string, unknown> }[];
} {
  const entries: { type: string; payload: Record<string, unknown> }[] = [];
  return {
    entries,
    event(type: string, payload: Record<string, unknown>) {
      entries.push({ type, payload });
    },
  } as StructuredLogger & { entries: { type: string; payload: Record<string, unknown> }[] };
}

describe('LoggerBridge', () => {
  it('should log llm.call.started events', () => {
    const eventBus = new EventBus();
    const logger = createMockLogger();
    const bridge = new LoggerBridge(eventBus, logger);
    bridge.start();

    eventBus.emit('llm.call.started', {
      model: 'mistral:7b',
      agentType: 'dev',
      promptLength: 500,
      timestamp: '2026-02-19T12:00:00.000Z',
    });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]?.type).toBe('llm.call.started');
    expect(logger.entries[0]?.payload.model).toBe('mistral:7b');
  });

  it('should log llm.call.completed events with metrics', () => {
    const eventBus = new EventBus();
    const logger = createMockLogger();
    const bridge = new LoggerBridge(eventBus, logger);
    bridge.start();

    eventBus.emit('llm.call.completed', {
      model: 'mistral:7b',
      agentType: 'reviewer',
      promptLength: 300,
      responseLength: 200,
      durationMs: 5000,
      tokenCount: 50,
    });

    expect(logger.entries).toHaveLength(1);
    const entry = logger.entries[0];
    expect(entry?.type).toBe('llm.call.completed');
    expect(entry?.payload.durationMs).toBe(5000);
    expect(entry?.payload.tokenCount).toBe(50);
  });

  it('should log workflow events alongside LLM events', () => {
    const eventBus = new EventBus();
    const logger = createMockLogger();
    const bridge = new LoggerBridge(eventBus, logger);
    bridge.start();

    eventBus.emit('story.workflow.started', { storyId: 'E1-S1', steps: ['dev'] });
    eventBus.emit('llm.call.completed', {
      model: 'mistral:7b',
      agentType: 'dev',
      durationMs: 1000,
      tokenCount: 25,
      promptLength: 100,
      responseLength: 100,
    });
    eventBus.emit('story.step.completed', { storyId: 'E1-S1', step: 'dev', status: 'ok' });

    expect(logger.entries).toHaveLength(3);
    expect(logger.entries.map((e) => e.type)).toEqual([
      'story.workflow.started',
      'llm.call.completed',
      'story.step.completed',
    ]);
  });
});
