import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpServer } from '../infrastructure/HttpServer.js';

describe('HttpServer', () => {
  let server: HttpServer;
  const TEST_PORT = 14242;

  beforeEach(() => {
    server = new HttpServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should start and listen on the given port', async () => {
    await server.start(TEST_PORT);
    expect(server.listening).toBe(true);
  });

  it('should respond to /health with JSON', async () => {
    await server.start(TEST_PORT);

    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      status: string;
      uptime: number;
      version: string;
      pid: number;
    };
    expect(data.status).toBe('ok');
    expect(data.version).toBe('0.1.0');
    expect(typeof data.uptime).toBe('number');
    expect(data.pid).toBe(process.pid);
  });

  it('should respond 404 to unknown routes', async () => {
    await server.start(TEST_PORT);

    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/unknown`);
    expect(res.status).toBe(404);
  });

  it('should stop cleanly', async () => {
    await server.start(TEST_PORT);
    expect(server.listening).toBe(true);
    await server.stop();
    expect(server.listening).toBe(false);
  });

  it('should handle stop when not started', async () => {
    await expect(server.stop()).resolves.toBeUndefined();
  });

  it('should serve SSE events on /events', async () => {
    const eventBus = new EventBus();
    server.setEventBus(eventBus);
    await server.start(TEST_PORT);

    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/events`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');

    // Read the initial :ok message
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      const { value } = await reader.read();
      const text = decoder.decode(value);
      expect(text).toContain(':ok');

      // Emit an event
      eventBus.emit('test.event', { data: 'hello' });

      // Read the SSE message
      const { value: value2 } = await reader.read();
      const text2 = decoder.decode(value2);
      expect(text2).toContain('data:');
      expect(text2).toContain('test.event');

      reader.cancel();
    }
  });
});
