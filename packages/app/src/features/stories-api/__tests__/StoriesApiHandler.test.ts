import { mkdirSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StoryStatusTracker, YamlStatusStore } from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  let testDir: string;
  let tracker: StoryStatusTracker;
  let handler: StoriesApiHandler;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    const store = new YamlStatusStore(testDir);
    tracker = new StoryStatusTracker(store);
    handler = new StoriesApiHandler(tracker);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return 409 when trying to edit in-progress story', () => {
    tracker.setStatus('E1-S1', 'ready');
    tracker.setStatus('E1-S1', 'in-progress');

    const req = createMockReq('PUT', '/api/stories/E1-S1');
    const res = createMockRes();
    handler.handle(req, res);

    expect(res.getStatusCode()).toBe(409);
    const body = JSON.parse(res.getBody());
    expect(body.error).toBe('story_locked');
    expect(body.reason).toBe('in-progress');
  });

  it('should allow editing stories not in-progress', () => {
    tracker.setStatus('E1-S1', 'ready');

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

  it('should return false for non-matching URLs', () => {
    const req = createMockReq('GET', '/health');
    const res = createMockRes();
    const handled = handler.handle(req, res);

    expect(handled).toBe(false);
  });
});
