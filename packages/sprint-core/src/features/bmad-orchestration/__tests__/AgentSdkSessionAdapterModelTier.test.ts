import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { DefaultModelTierRouter } from '../domain/ModelTierRouter.js';
import type { BMADSessionContext } from '../domain/ports/BMADSessionPort.js';
import {
  AgentSdkSessionAdapter,
  type QueryFunction,
} from '../infrastructure/AgentSdkSessionAdapter.js';

function makeContext(): BMADSessionContext {
  return { projectPath: '/tmp/test-project', storyId: 'EA9-S1' };
}

function makeResultSuccess(result: string): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    result,
    duration_ms: 1,
    duration_api_ms: 1,
    is_error: false,
    num_turns: 1,
    total_cost_usd: 0.01,
    usage: { input_tokens: 10, output_tokens: 5 },
    modelUsage: {},
    permission_denials: [],
    uuid: 'uuid-result',
    session_id: 'sdk-session-abc',
  } as unknown as SDKMessage;
}

function capturingQuery(): {
  queryFn: QueryFunction;
  captured: { options: Record<string, unknown> }[];
} {
  const captured: { options: Record<string, unknown> }[] = [];
  const queryFn: QueryFunction = (params) => {
    captured.push({ options: (params.options ?? {}) as Record<string, unknown> });
    return (async function* () {
      yield makeResultSuccess('ok');
    })();
  };
  return { queryFn, captured };
}

describe('AgentSdkSessionAdapter model tiering', () => {
  it('sets options.model to sonnet for a dev-story command', async () => {
    const { queryFn, captured } = capturingQuery();
    const adapter = new AgentSdkSessionAdapter(
      undefined,
      { modelRouter: new DefaultModelTierRouter() },
      queryFn,
    );
    await adapter.startSession('/bmad-bmm-dev-story', makeContext());
    expect(captured[0]?.options.model).toBe('sonnet');
  });

  it('sets options.model to opus for a create-story command', async () => {
    const { queryFn, captured } = capturingQuery();
    const adapter = new AgentSdkSessionAdapter(
      undefined,
      { modelRouter: new DefaultModelTierRouter() },
      queryFn,
    );
    await adapter.startSession('/bmad-bmm-create-story', makeContext());
    expect(captured[0]?.options.model).toBe('opus');
  });

  it('reuses the start-session model on follow-up turns', async () => {
    const { queryFn, captured } = capturingQuery();
    const adapter = new AgentSdkSessionAdapter(
      undefined,
      { modelRouter: new DefaultModelTierRouter() },
      queryFn,
    );
    const handle = await adapter.startSession('/bmad-bmm-create-story', makeContext());
    await adapter.continueSession(handle.sessionId, 'C');
    expect(captured).toHaveLength(2);
    expect(captured[0]?.options.model).toBe('opus');
    expect(captured[1]?.options.model).toBe('opus');
  });

  it('omits options.model when no router is configured (backward compatible)', async () => {
    const { queryFn, captured } = capturingQuery();
    const adapter = new AgentSdkSessionAdapter(undefined, {}, queryFn);
    await adapter.startSession('/bmad-bmm-dev-story', makeContext());
    expect(captured[0]?.options.model).toBeUndefined();
  });
});
