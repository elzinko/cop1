import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { type AuthQueryFn, checkAuth } from '../infrastructure/AuthChecker.js';

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
  it('returns ok + model from the system/init message on success', async () => {
    const r = await checkAuth(mockQuery([systemInit('claude-test'), resultSuccess()]));
    expect(r).toEqual({ ok: true, model: 'claude-test' });
  });

  it('returns ok:false on a non-success result, keeping the model seen', async () => {
    const r = await checkAuth(mockQuery([systemInit('claude-test'), resultError()]));
    expect(r.ok).toBe(false);
    expect(r.model).toBe('claude-test');
  });

  it('returns ok:false with the error message when the query throws', async () => {
    const throwing: AuthQueryFn = () => {
      throw new Error('401 invalid credentials');
    };
    const r = await checkAuth(throwing);
    expect(r).toEqual({ ok: false, model: null, error: '401 invalid credentials' });
  });

  it('returns ok:false when no result message is produced', async () => {
    const r = await checkAuth(mockQuery([systemInit('claude-test')]));
    expect(r.ok).toBe(false);
    expect(r.model).toBe('claude-test');
  });
});
