import { mkdirSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { BlockageService } from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BlocageApiHandler } from '../application/BlocageApiHandler.js';

function createMockRes() {
  let statusCode = 0;
  let body = '';
  return {
    writeHead(code: number, _headers?: Record<string, string>) {
      statusCode = code;
    },
    end(data?: string) {
      body = data ?? '';
    },
    getStatusCode: () => statusCode,
    getBody: () => body,
  } as unknown as ServerResponse & { getStatusCode: () => number; getBody: () => string };
}

function createMockReq(method: string, url: string, bodyStr?: string) {
  const handlers: Record<string, Array<(arg: unknown) => void>> = {};
  return {
    method,
    url,
    on(event: string, cb: (arg: unknown) => void) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(cb);
    },
    triggerBody() {
      if (bodyStr) {
        for (const h of handlers.data ?? []) h(Buffer.from(bodyStr));
      }
      for (const h of handlers.end ?? []) h(undefined);
    },
  } as unknown as IncomingMessage & { triggerBody: () => void };
}

describe('BlocageApiHandler', () => {
  let testDir: string;
  let eventBus: EventBus;
  let service: BlockageService;
  let handler: BlocageApiHandler;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-blk-api-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    eventBus = new EventBus();
    service = new BlockageService(testDir, eventBus);
    handler = new BlocageApiHandler(service);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should resolve a blocage via POST', () => {
    const blocage = service.declare('E1-S1', 'technical', 'Build failure');

    const req = createMockReq(
      'POST',
      `/api/blocages/${blocage.id}/resolve`,
      '{"response":"Fixed"}',
    );
    const res = createMockRes();
    handler.handle(req, res);
    req.triggerBody();

    expect(res.getStatusCode()).toBe(200);
    const body = JSON.parse(res.getBody());
    expect(body.status).toBe('resolved');
  });

  it('should list open blocages', () => {
    service.declare('E1-S1', 'timeout', 'Too slow');

    const req = createMockReq('GET', '/api/blocages');
    const res = createMockRes();
    handler.handle(req, res);

    expect(res.getStatusCode()).toBe(200);
    const body = JSON.parse(res.getBody());
    expect(body).toHaveLength(1);
  });

  it('should return 404 for non-existent blocage', () => {
    const req = createMockReq('POST', '/api/blocages/BLK-fake/resolve', '{"response":"test"}');
    const res = createMockRes();
    handler.handle(req, res);
    req.triggerBody();

    expect(res.getStatusCode()).toBe(404);
  });

  it('should return false for non-matching URL', () => {
    const req = createMockReq('GET', '/health');
    const res = createMockRes();
    const handled = handler.handle(req, res);

    expect(handled).toBe(false);
  });
});
