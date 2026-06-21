import { afterEach, describe, expect, it } from 'vitest';
import { HttpServer } from '../infrastructure/HttpServer.js';

describe('HttpServer GET /api/auth/check', () => {
  let server: HttpServer;
  const PORT = 14411;

  afterEach(async () => {
    await server?.stop();
  });

  it('returns the auth checker result (ok + model)', async () => {
    server = new HttpServer();
    server.setAuthChecker(async () => ({ ok: true, model: 'claude-test' }));
    await server.start(PORT);
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/check`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, model: 'claude-test' });
  });

  it('reports not-configured (200, no secret) when no checker is set', async () => {
    server = new HttpServer();
    await server.start(PORT);
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/check`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('surfaces ok:false as 200 so the UI renders red', async () => {
    server = new HttpServer();
    server.setAuthChecker(async () => ({ ok: false, model: null, error: '401' }));
    await server.start(PORT);
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/check`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, model: null, error: '401' });
  });
});
