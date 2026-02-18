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
});
