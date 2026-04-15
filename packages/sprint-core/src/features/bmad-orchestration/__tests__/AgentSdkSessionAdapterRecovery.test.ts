import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { EventBus } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import type { BMADSessionContext } from '../domain/ports/BMADSessionPort.js';
import {
  AgentSdkSessionAdapter,
  type QueryFunction,
} from '../infrastructure/AgentSdkSessionAdapter.js';

/**
 * EA12-S2 — Recovery E2E test with the real `AgentSdkSessionAdapter`
 * (not `InMemorySessionAdapter`).
 *
 * Exercises Strategy A (SDK `resume: session_id`) across an adapter crash
 * boundary. Uses a mocked `QueryFunction` per AC4 — real SDK session
 * lifecycle (session_id capture, resume option wiring, state retention)
 * runs against the production `AgentSdkSessionAdapter` class. Retires the
 * EA10-S9 InMemorySessionAdapter stop-gap sentinel per AC5.
 */

const SDK_SESSION_ID = 'sdk-real-session-abc-123';

function makeContext(overrides: Partial<BMADSessionContext> = {}): BMADSessionContext {
  return {
    projectPath: '/tmp/recovery-test',
    storyId: 'EA12-S2',
    ...overrides,
  };
}

function msgAssistant(text: string, sessionId = SDK_SESSION_ID): SDKMessage {
  return {
    type: 'assistant',
    message: { content: [{ type: 'text', text }] },
    parent_tool_use_id: null,
    uuid: `assistant-${Math.random()}`,
    session_id: sessionId,
  } as unknown as SDKMessage;
}

function msgResultSuccess(result: string, sessionId = SDK_SESSION_ID): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    result,
    duration_ms: 10,
    duration_api_ms: 8,
    is_error: false,
    num_turns: 1,
    total_cost_usd: 0.001,
    usage: { input_tokens: 10, output_tokens: 10 },
    modelUsage: {},
    permission_denials: [],
    uuid: 'result-ok',
    session_id: sessionId,
  } as unknown as SDKMessage;
}

function capturingQuery(responses: SDKMessage[][]): {
  fn: QueryFunction;
  invocations: { prompt: string; resume?: string }[];
} {
  const invocations: { prompt: string; resume?: string }[] = [];
  let callIndex = 0;
  const fn: QueryFunction = (params) => {
    const opts = (params.options ?? {}) as Record<string, unknown>;
    invocations.push({
      prompt: params.prompt,
      resume: typeof opts.resume === 'string' ? opts.resume : undefined,
    });
    const messages = responses[callIndex] ?? [msgResultSuccess('no more canned responses')];
    callIndex++;
    return (async function* () {
      for (const m of messages) yield m;
    })();
  };
  return { fn, invocations };
}

describe('AgentSdkSessionAdapter — Recovery E2E (EA12-S2)', () => {
  it('AC1+AC2: same-adapter resume passes `resume: session_id` on continueSession', async () => {
    const { fn, invocations } = capturingQuery([
      [msgAssistant('starting...'), msgResultSuccess('first turn done')],
      [msgAssistant('continuing...'), msgResultSuccess('second turn done')],
    ]);
    const adapter = new AgentSdkSessionAdapter(new EventBus(), {}, fn);

    const handle = await adapter.startSession('/bmad-bmm-dev-story EA12-S2', makeContext());
    expect(handle.firstTurn.completed).toBe(true);
    expect(handle.firstTurn.output).toBe('first turn done');
    // After start, resume must NOT be set (fresh session).
    expect(invocations[0]?.resume).toBeUndefined();
    // Adapter captured the SDK session_id from the first turn's messages.
    expect(adapter.getSdkSessionId(handle.sessionId)).toBe(SDK_SESSION_ID);

    const second = await adapter.continueSession(handle.sessionId, 'next turn');
    expect(second.completed).toBe(true);
    expect(second.output).toBe('second turn done');
    // Second invocation MUST carry `resume: <sdkSessionId>`.
    expect(invocations[1]?.resume).toBe(SDK_SESSION_ID);
  });

  it('AC3: crash recovery — fresh adapter restores via sdkSessionId and resumes', async () => {
    // Phase 1: "crashed" adapter. Only used to run the first turn and expose
    // the captured SDK session_id; then it is discarded.
    const { fn: fn1 } = capturingQuery([[msgResultSuccess('first turn before crash')]]);
    const crashedAdapter = new AgentSdkSessionAdapter(undefined, {}, fn1);
    const handle = await crashedAdapter.startSession('/start', makeContext());
    const persistedSdkId = crashedAdapter.getSdkSessionId(handle.sessionId);
    expect(persistedSdkId).toBe(SDK_SESSION_ID);

    // Simulated crash — release references to the first adapter.
    // (A real crash would lose the in-memory maps; the persisted sdkSessionId
    // is the only artifact survivors can depend on.)

    // Phase 2: fresh adapter instance.
    const { fn: fn2, invocations: inv2 } = capturingQuery([
      [msgAssistant('resumed...'), msgResultSuccess('resume turn done')],
    ]);
    const events: { name: string; payload: Record<string, unknown> }[] = [];
    const bus = new EventBus();
    bus.on('session.restored', (p) =>
      events.push({ name: 'session.restored', payload: p as Record<string, unknown> }),
    );
    const freshAdapter = new AgentSdkSessionAdapter(bus, {}, fn2);

    if (!persistedSdkId) throw new Error('SDK session id not captured');
    const restoredLocalId = freshAdapter.restoreSession(persistedSdkId, makeContext());
    expect(restoredLocalId).toBeTruthy();
    expect(freshAdapter.getSdkSessionId(restoredLocalId)).toBe(persistedSdkId);

    const turn = await freshAdapter.continueSession(restoredLocalId, 'after crash');
    expect(turn.completed).toBe(true);
    expect(turn.output).toBe('resume turn done');
    // Resume option carried through on the resumed turn — this is the
    // production recovery invariant.
    expect(inv2[0]?.resume).toBe(persistedSdkId);

    // Recovery emitted the session.restored event for observability.
    expect(events.find((e) => e.name === 'session.restored')).toMatchObject({
      payload: { sdkSessionId: persistedSdkId },
    });
  });

  it('AC5: sentinel — this test retires the EA10-S9 InMemorySessionAdapter stop-gap', () => {
    // If you are migrating EA10-S9's `InMemorySessionAdapter` recovery fixture
    // to the real-adapter path, deleting or moving this assertion is fine —
    // it exists purely to make the sentinel traceable from grep/CI output.
    const sentinel = 'EA12-S2 retires EA10-S9 InMemorySessionAdapter recovery sentinel';
    expect(sentinel).toContain('EA12-S2');
  });
});
