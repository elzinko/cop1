import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { type AuthQueryFn, checkAuth, sanitizeError } from '../infrastructure/AuthChecker.js';

function mockQuery(messages: SDKMessage[]): AuthQueryFn {
  return () =>
    (async function* () {
      for (const m of messages) yield m;
    })();
}

const systemInit = (model: string): SDKMessage =>
  ({ type: 'system', subtype: 'init', model, session_id: 's', uuid: 'u' }) as unknown as SDKMessage;
const resultSuccess = (): SDKMessage =>
  ({
    type: 'result',
    subtype: 'success',
    result: 'ok',
    session_id: 's',
    uuid: 'u',
  }) as unknown as SDKMessage;
const resultError = (): SDKMessage =>
  ({
    type: 'result',
    subtype: 'error_during_execution',
    session_id: 's',
    uuid: 'u',
  }) as unknown as SDKMessage;

describe('checkAuth', () => {
  it('returns ok + model + availability:ok from the system/init message on success', async () => {
    const r = await checkAuth(mockQuery([systemInit('claude-test'), resultSuccess()]));
    expect(r).toEqual({ ok: true, model: 'claude-test', availability: 'ok' });
  });

  it('returns ok:false on a non-success result, keeping the model seen', async () => {
    const r = await checkAuth(mockQuery([systemInit('claude-test'), resultError()]));
    expect(r.ok).toBe(false);
    expect(r.model).toBe('claude-test');
    expect(r.availability).toBe('unavailable');
  });

  it('maps a hard error (auth) to availability:unavailable', async () => {
    const throwing: AuthQueryFn = () => {
      throw new Error('401 invalid credentials');
    };
    const r = await checkAuth(throwing);
    expect(r).toEqual({
      ok: false,
      model: null,
      error: '401 invalid credentials',
      availability: 'unavailable',
    });
  });

  it('maps a transient blockage (overloaded/5xx/network) to availability:degraded', async () => {
    const overloaded: AuthQueryFn = () => {
      throw new Error('API Error: 529 {"type":"overloaded_error"}');
    };
    const r = await checkAuth(overloaded);
    expect(r.ok).toBe(false);
    expect(r.availability).toBe('degraded');
  });

  it('returns ok:false when no result message is produced', async () => {
    const r = await checkAuth(mockQuery([systemInit('claude-test')]));
    expect(r.ok).toBe(false);
    expect(r.model).toBe('claude-test');
    expect(r.availability).toBe('unavailable');
  });

  it('truncates a verbose error before returning it to the browser', async () => {
    const longMsg = `boom ${'x'.repeat(500)}`;
    const r = await checkAuth(() => {
      throw new Error(longMsg);
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
    // 200 chars + the single-char ellipsis.
    expect((r.error as string).length).toBeLessThanOrEqual(201);
    expect(r.error?.endsWith('…')).toBe(true);
  });

  it('redacts a token-shaped secret and collapses newlines in the error', async () => {
    const r = await checkAuth(() => {
      throw new Error('failed with key\n  sk-ant-oat01-SECRETSECRET\n  at line 2');
    });
    expect(r.error).toBe('failed with key [redacted] at line 2');
  });
});

describe('sanitizeError', () => {
  it('leaves a short clean message unchanged', () => {
    expect(sanitizeError('401 invalid credentials')).toBe('401 invalid credentials');
  });

  it('collapses whitespace/newlines to single spaces', () => {
    expect(sanitizeError('a\n\n  b\tc')).toBe('a b c');
  });

  it('redacts token-shaped secrets', () => {
    expect(sanitizeError('leak sk-ant-oat01-ABCdef_123 end')).toBe('leak [redacted] end');
  });

  it('truncates to a bounded length with an ellipsis', () => {
    const out = sanitizeError('y'.repeat(500));
    expect(out.length).toBe(201);
    expect(out.endsWith('…')).toBe(true);
  });
});
