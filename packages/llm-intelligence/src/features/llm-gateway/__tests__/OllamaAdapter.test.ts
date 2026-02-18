import { type Server, createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LLMUnavailableError } from '../domain/errors/LLMUnavailableError.js';
import { OllamaAdapter } from '../infrastructure/OllamaAdapter.js';

const TEST_PORT = 14244;

function createMockOllamaServer(
  handler: (req: { url: string; method: string; body: string }) => {
    status: number;
    body: string;
  },
): Server {
  return createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const result = handler({ url: req.url ?? '', method: req.method ?? '', body });
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(result.body);
    });
  });
}

describe('OllamaAdapter', () => {
  let server: Server;
  let adapter: OllamaAdapter;

  beforeEach(() => {
    adapter = new OllamaAdapter(`http://127.0.0.1:${TEST_PORT}`);
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('should stream completion chunks from Ollama NDJSON', async () => {
    const ndjson = [
      JSON.stringify({ response: 'Hello', done: false }),
      JSON.stringify({ response: ' world', done: false }),
      JSON.stringify({ response: '', done: true }),
    ].join('\n');

    server = createMockOllamaServer(({ url }) => {
      if (url === '/api/generate') {
        return { status: 200, body: ndjson };
      }
      return { status: 404, body: '{}' };
    });

    await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));

    const chunks: Array<{ text: string; done: boolean }> = [];
    for await (const chunk of adapter.complete({ prompt: 'Hi', model: 'llama3' })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.text === 'Hello')).toBe(true);
    expect(chunks.some((c) => c.done === true)).toBe(true);
  });

  it('should throw LLMUnavailableError when Ollama is not running', async () => {
    const deadAdapter = new OllamaAdapter('http://127.0.0.1:19999');
    const iterator = deadAdapter.complete({ prompt: 'test', model: 'llama3' });

    await expect(async () => {
      for await (const _chunk of iterator) {
        // should throw before yielding
      }
    }).rejects.toThrow(LLMUnavailableError);
  });

  it('should return health available when Ollama responds', async () => {
    server = createMockOllamaServer(({ url }) => {
      if (url === '/api/tags') {
        return {
          status: 200,
          body: JSON.stringify({ models: [{ name: 'llama3' }, { name: 'codellama' }] }),
        };
      }
      return { status: 404, body: '{}' };
    });

    await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));

    const health = await adapter.health();
    expect(health.available).toBe(true);
    expect(health.models).toContain('llama3');
    expect(health.models).toContain('codellama');
  });

  it('should return health unavailable when Ollama is down', async () => {
    const deadAdapter = new OllamaAdapter('http://127.0.0.1:19999');
    const health = await deadAdapter.health();
    expect(health.available).toBe(false);
    expect(health.models).toEqual([]);
  });
});
