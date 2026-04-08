import type { IncomingMessage, ServerResponse } from 'node:http';
import { InMemoryStatusReader } from '@cop1/sprint-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoriesApiHandler } from '../application/StoriesApiHandler.js';

function createMockRes() {
  let statusCode = 0;
  let body = '';

  return {
    writeHead(code: number, _h?: Record<string, string>) {
      statusCode = code;
    },
    end(data?: string) {
      body = data ?? '';
    },
    getStatusCode: () => statusCode,
    getBody: () => body,
  } as unknown as ServerResponse & { getStatusCode: () => number; getBody: () => string };
}

function createMockReq(method: string, url: string) {
  return { method, url } as unknown as IncomingMessage;
}

describe('StoriesApiHandler', () => {
  let statusReader: InMemoryStatusReader;
  let handler: StoriesApiHandler;

  beforeEach(() => {
    statusReader = new InMemoryStatusReader();
    handler = new StoriesApiHandler(statusReader);
  });

  it('should return 409 when trying to edit in-progress story', () => {
    statusReader.setStatus('E1-S1', 'in-progress');

    const req = createMockReq('PUT', '/api/stories/E1-S1');
    const res = createMockRes();
    handler.handle(req, res);

    expect(res.getStatusCode()).toBe(409);
    const body = JSON.parse(res.getBody());
    expect(body.error).toBe('story_locked');
    expect(body.reason).toBe('in-progress');
  });

  it('should allow editing stories not in-progress', () => {
    statusReader.setStatus('E1-S1', 'ready-for-dev');

    const req = createMockReq('PUT', '/api/stories/E1-S1');
    const res = createMockRes();
    handler.handle(req, res);

    expect(res.getStatusCode()).toBe(200);
  });

  it('should allow editing unknown stories', () => {
    const req = createMockReq('PUT', '/api/stories/UNKNOWN');
    const res = createMockRes();
    handler.handle(req, res);

    expect(res.getStatusCode()).toBe(200);
  });

  it('should return status for GET /api/stories/:id with known story', () => {
    statusReader.setStatus('E1-S1', 'done');

    const req = createMockReq('GET', '/api/stories/E1-S1');
    const res = createMockRes();
    const handled = handler.handle(req, res);

    expect(handled).toBe(true);
    expect(res.getStatusCode()).toBe(200);
    const body = JSON.parse(res.getBody());
    expect(body.storyId).toBe('E1-S1');
    expect(body.status).toBe('done');
  });

  it('should return unknown status for GET /api/stories/:id with unknown story', () => {
    const req = createMockReq('GET', '/api/stories/UNKNOWN');
    const res = createMockRes();
    const handled = handler.handle(req, res);

    expect(handled).toBe(true);
    expect(res.getStatusCode()).toBe(200);
    const body = JSON.parse(res.getBody());
    expect(body.storyId).toBe('UNKNOWN');
    expect(body.status).toBe('unknown');
  });

  it('should return false for non-matching URLs', () => {
    const req = createMockReq('GET', '/health');
    const res = createMockRes();
    const handled = handler.handle(req, res);

    expect(handled).toBe(false);
  });
});
