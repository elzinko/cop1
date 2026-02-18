import type { ConfigPort } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import { LLMGateway } from '../application/LLMGateway.js';
import { LLMRouter } from '../application/LLMRouter.js';
import type { LLMProvider } from '../domain/ports/LLMProvider.js';
import type { LLMChunk } from '../domain/types/LLMChunk.js';
import type { LLMRequest } from '../domain/types/LLMRequest.js';
import { LLMCodeGenerator } from '../infrastructure/LLMCodeGenerator.js';

const mockConfig: ConfigPort = {
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
    llm_routing: { dev: 'llama3.2', reviewer: 'llama3.2', default: 'llama3.2' },
    llm_fallback: { default: 'llama3.2' },
    git: { auto_merge: false },
    blocage_rules: {},
    schedule: { auto_start: [] },
  }),
};

function createMockProvider(response: string): LLMProvider {
  return {
    async *complete(_request: LLMRequest): AsyncIterable<LLMChunk> {
      const words = response.split(' ');
      for (let i = 0; i < words.length; i++) {
        const prefix = i > 0 ? ' ' : '';
        yield { text: prefix + words[i], done: i === words.length - 1 };
      }
    },
    async health() {
      return { available: true, models: ['llama3.2'] };
    },
  };
}

function createGateway(response: string): LLMGateway {
  const router = new LLMRouter(mockConfig);
  return new LLMGateway(createMockProvider(response)).withRouter(router);
}

describe('LLMCodeGenerator', () => {
  it('should collect stream and return full response', async () => {
    const code = '```file:src/hello.ts\nconsole.log("hello");\n```';
    const generator = new LLMCodeGenerator(createGateway(code));

    const result = await generator.generate('Write a hello world');

    expect(result).toBe(code);
  });

  it('should return empty string for empty response', async () => {
    const provider: LLMProvider = {
      async *complete(_request: LLMRequest): AsyncIterable<LLMChunk> {
        yield { text: '', done: true };
      },
      async health() {
        return { available: true, models: ['llama3.2'] };
      },
    };
    const gateway = new LLMGateway(provider).withRouter(new LLMRouter(mockConfig));
    const generator = new LLMCodeGenerator(gateway);

    const result = await generator.generate('test');

    expect(result).toBe('');
  });

  it('should concatenate multiple chunks correctly', async () => {
    const provider: LLMProvider = {
      async *complete(_request: LLMRequest): AsyncIterable<LLMChunk> {
        yield { text: 'line1\n', done: false };
        yield { text: 'line2\n', done: false };
        yield { text: 'line3', done: true };
      },
      async health() {
        return { available: true, models: ['llama3.2'] };
      },
    };
    const gateway = new LLMGateway(provider).withRouter(new LLMRouter(mockConfig));
    const generator = new LLMCodeGenerator(gateway);

    const result = await generator.generate('test');

    expect(result).toBe('line1\nline2\nline3');
  });
});
