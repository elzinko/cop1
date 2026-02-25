import { EventBus } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import { LLMGateway } from '../application/LLMGateway.js';
import type { LLMProvider } from '../domain/ports/LLMProvider.js';
import type { LLMChunk } from '../domain/types/LLMChunk.js';
import type { LLMRequest } from '../domain/types/LLMRequest.js';

function createMockProvider(chunks: LLMChunk[]): LLMProvider {
  return {
    async *complete(_request: LLMRequest): AsyncIterable<LLMChunk> {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
    async health() {
      return { available: true, models: ['llama3'] };
    },
  };
}

describe('LLMGateway', () => {
  it('should stream chunks from provider', async () => {
    const chunks: LLMChunk[] = [
      { text: 'Hello', done: false },
      { text: ' world', done: false },
      { text: '', done: true },
    ];
    const gateway = new LLMGateway(createMockProvider(chunks));

    const received: LLMChunk[] = [];
    for await (const chunk of gateway.complete('test prompt', 'llama3')) {
      received.push(chunk);
    }

    expect(received).toEqual(chunks);
  });

  it('should return health status from provider', async () => {
    const gateway = new LLMGateway(createMockProvider([]));
    const health = await gateway.health();

    expect(health.available).toBe(true);
    expect(health.models).toContain('llama3');
  });

  it('should emit llm.call.started and llm.call.completed with EventBus', async () => {
    const chunks: LLMChunk[] = [
      { text: 'Hello world response', done: false },
      { text: '', done: true },
    ];
    const eventBus = new EventBus();
    const gateway = new LLMGateway(createMockProvider(chunks), eventBus);

    const events: { type: string; payload: unknown }[] = [];
    eventBus.on('llm.call.started', (p: unknown) => events.push({ type: 'started', payload: p }));
    eventBus.on('llm.call.completed', (p: unknown) =>
      events.push({ type: 'completed', payload: p }),
    );

    for await (const _chunk of gateway.complete('test prompt', 'llama3')) {
      // consume stream
    }

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe('started');

    const started = events[0]?.payload as Record<string, unknown>;
    expect(started.model).toBe('llama3');
    expect(started.agentType).toBe('direct');
    expect(started.promptLength).toBe(11);

    const completed = events[1]?.payload as Record<string, unknown>;
    expect(completed.model).toBe('llama3');
    expect(completed.agentType).toBe('direct');
    expect(completed.responseLength).toBe(20);
    expect(completed.tokenCount).toBe(5); // Math.ceil(20 / 4)
    expect(completed.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should work without EventBus (backward compatibility)', async () => {
    const chunks: LLMChunk[] = [
      { text: 'Hello', done: false },
      { text: '', done: true },
    ];
    const gateway = new LLMGateway(createMockProvider(chunks));

    const received: LLMChunk[] = [];
    for await (const chunk of gateway.complete('test', 'llama3')) {
      received.push(chunk);
    }

    expect(received).toEqual(chunks);
  });

  it('should emit events with correct agentType for completeForAgent', async () => {
    const chunks: LLMChunk[] = [{ text: 'code here', done: true }];
    const eventBus = new EventBus();
    const { LLMRouter } = await import('../application/LLMRouter.js');
    const mockConfig = {
      get: () => ({
        project: { name: 'test', path: '.' },
        daemon: { port: 4242 },
        sprint: { default_duration_hours: 2 },
        resources: {
          ram_budget_night_gb: 48,
          ram_budget_day_gb: 20,
          suspension_threshold_percent: 75,
          polling_interval_ms: 1000,
        },
        llm_routing: { dev: 'mistral:7b', default: 'mistral:7b' },
        llm_fallback: { default: 'mistral:7b' },
        git: { auto_merge: false },
        blocage_rules: {},
        schedule: { auto_start: [] },
        workflow: { useBMAD: true },
      }),
    };
    const gateway = new LLMGateway(createMockProvider(chunks), eventBus).withRouter(
      new LLMRouter(mockConfig),
    );

    const completed: Record<string, unknown>[] = [];
    eventBus.on('llm.call.completed', (p: unknown) => completed.push(p as Record<string, unknown>));

    for await (const _chunk of gateway.completeForAgent('dev', 'write hello world')) {
      // consume
    }

    expect(completed).toHaveLength(1);
    expect(completed[0]?.agentType).toBe('dev');
    expect(completed[0]?.model).toBe('mistral:7b');
  });

  it('should estimate tokenCount as ceil(responseLength / 4)', async () => {
    // 400 chars → 100 tokens
    const longText = 'a'.repeat(400);
    const chunks: LLMChunk[] = [{ text: longText, done: true }];
    const eventBus = new EventBus();
    const gateway = new LLMGateway(createMockProvider(chunks), eventBus);

    const completed: Record<string, unknown>[] = [];
    eventBus.on('llm.call.completed', (p: unknown) => completed.push(p as Record<string, unknown>));

    for await (const _chunk of gateway.complete('p', 'llama3')) {
      // consume
    }

    expect(completed[0]?.responseLength).toBe(400);
    expect(completed[0]?.tokenCount).toBe(100);
  });
});
