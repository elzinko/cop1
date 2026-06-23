import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, describe, expect, it } from 'vitest';
import type { BMADSessionContext, QuestionHandler } from '../domain/ports/BMADSessionPort.js';
import {
  AgentSdkSessionAdapter,
  type QueryFunction,
} from '../infrastructure/AgentSdkSessionAdapter.js';

function makeContext(overrides: Partial<BMADSessionContext> = {}): BMADSessionContext {
  return {
    projectPath: '/tmp/test-project',
    storyId: 'EA9-S1',
    ...overrides,
  };
}

function makeAssistantMessage(text: string, sessionId = 'sdk-session-abc'): SDKMessage {
  return {
    type: 'assistant',
    message: {
      content: [{ type: 'text', text }],
    },
    parent_tool_use_id: null,
    uuid: 'uuid-1',
    session_id: sessionId,
  } as unknown as SDKMessage;
}

function makeResultSuccess(result: string, sessionId = 'sdk-session-abc'): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    result,
    duration_ms: 1000,
    duration_api_ms: 800,
    is_error: false,
    num_turns: 1,
    total_cost_usd: 0.01,
    usage: { input_tokens: 100, output_tokens: 50 },
    modelUsage: {},
    permission_denials: [],
    uuid: 'uuid-result',
    session_id: sessionId,
  } as unknown as SDKMessage;
}

function makeResultError(
  subtype: string,
  errors: string[] = [],
  sessionId = 'sdk-session-abc',
): SDKMessage {
  return {
    type: 'result',
    subtype,
    errors,
    duration_ms: 500,
    duration_api_ms: 400,
    is_error: true,
    num_turns: 1,
    total_cost_usd: 0.005,
    usage: { input_tokens: 50, output_tokens: 10 },
    modelUsage: {},
    permission_denials: [],
    uuid: 'uuid-error',
    session_id: sessionId,
  } as unknown as SDKMessage;
}

function createMockQuery(messages: SDKMessage[]): QueryFunction {
  return (_params) => {
    return (async function* () {
      for (const msg of messages) {
        yield msg;
      }
    })();
  };
}

function createCapturingQuery(messages: SDKMessage[]): {
  queryFn: QueryFunction;
  captured: { prompt: string; options: unknown }[];
} {
  const captured: { prompt: string; options: unknown }[] = [];
  const queryFn: QueryFunction = (params) => {
    captured.push({ prompt: params.prompt, options: params.options });
    return (async function* () {
      for (const msg of messages) {
        yield msg;
      }
    })();
  };
  return { queryFn, captured };
}

describe('AgentSdkSessionAdapter', () => {
  let eventBus: EventBus;

  afterEach(() => {
    eventBus?.removeAllListeners();
  });

  it('should start a session and return SessionHandle with firstTurn result', async () => {
    const queryFn = createMockQuery([
      makeAssistantMessage('Working on it...'),
      makeResultSuccess('Done!'),
    ]);
    eventBus = new EventBus();
    const adapter = new AgentSdkSessionAdapter(eventBus, {}, queryFn);

    const handle = await adapter.startSession('/bmad-bmm-dev-story EA9-S1', makeContext());

    expect(handle.sessionId).toBeDefined();
    expect(typeof handle.sessionId).toBe('string');
    expect(handle.firstTurn.completed).toBe(true);
    expect(handle.firstTurn.output).toBe('Done!');
    expect(handle.firstTurn.error).toBeUndefined();
    expect(handle.firstTurn.tokensUsed).toBe(150);
    expect(handle.firstTurn.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should emit tokensUsed in the session.workflow.completed event', async () => {
    const queryFn = createMockQuery([
      makeAssistantMessage('Working...'),
      makeResultSuccess('Done!'),
    ]);
    eventBus = new EventBus();
    const completed: { tokensUsed?: unknown }[] = [];
    eventBus.on('session.workflow.completed', (p) => completed.push(p as { tokensUsed?: unknown }));
    const adapter = new AgentSdkSessionAdapter(eventBus, {}, queryFn);

    await adapter.startSession('/bmad-bmm-dev-story EA9-S1', makeContext());

    expect(completed).toHaveLength(1);
    expect(completed[0]?.tokensUsed).toBe(150);
  });

  it('should emit tokensUsed in the session.workflow.failed event', async () => {
    const queryFn = createMockQuery([
      makeAssistantMessage('Working...'),
      makeResultError('error_max_turns', ['Max turns exceeded']),
    ]);
    eventBus = new EventBus();
    const failed: { tokensUsed?: unknown }[] = [];
    eventBus.on('session.workflow.failed', (p) => failed.push(p as { tokensUsed?: unknown }));
    const adapter = new AgentSdkSessionAdapter(eventBus, {}, queryFn);

    await adapter.startSession('/bmad-bmm-dev-story EA9-S1', makeContext());

    expect(failed).toHaveLength(1);
    // makeResultError reports usage { input_tokens: 50, output_tokens: 10 } => 60
    expect(failed[0]?.tokensUsed).toBe(60);
  });

  it('should pass correct SDK options to query function', async () => {
    const { queryFn, captured } = createCapturingQuery([makeResultSuccess('ok')]);
    const adapter = new AgentSdkSessionAdapter(
      undefined,
      { maxTurns: 15, maxBudgetUsd: 2.5 },
      queryFn,
    );

    await adapter.startSession('/test-command', makeContext());

    expect(captured).toHaveLength(1);
    const opts = captured[0]?.options as Record<string, unknown>;
    expect(opts.maxTurns).toBe(15);
    expect(opts.maxBudgetUsd).toBe(2.5);
    expect(opts.cwd).toBe('/tmp/test-project');
    expect(opts.systemPrompt).toEqual({ type: 'preset', preset: 'claude_code' });
    expect(opts.settingSources).toEqual(['project']);
    expect(opts.allowedTools).toEqual([
      'Skill',
      'Read',
      'Write',
      'Edit',
      'Bash',
      'Glob',
      'Grep',
      'AskUserQuestion',
    ]);
    // The SDK `tools` option is for custom MCP tool definitions, not built-in
    // tool-name strings — it must not be set with tool names.
    expect('tools' in opts).toBe(false);
    expect(opts.canUseTool).toBeDefined();
  });

  it('should treat a result with subtype=success but is_error=true as a failed session', async () => {
    // The SDK reports the agent surfacing an API error (e.g. a 4xx) as
    // subtype=success + is_error=true, with the error text in `result`. The
    // adapter must NOT count that as success (no false-positive story advance).
    const apiError =
      'API Error: 400 {"type":"error","error":{"message":"`tool_use` ids must be unique"}}';
    const queryFn = createMockQuery([
      makeAssistantMessage('attempting...'),
      {
        type: 'result',
        subtype: 'success',
        result: apiError,
        is_error: true,
        duration_ms: 500,
        duration_api_ms: 400,
        num_turns: 2,
        total_cost_usd: 0.01,
        usage: { input_tokens: 100, output_tokens: 50 },
        modelUsage: {},
        permission_denials: [],
        uuid: 'uuid-iserr',
        session_id: 'sdk-session-abc',
      } as unknown as SDKMessage,
    ]);
    eventBus = new EventBus();
    const failed: { tokensUsed?: unknown }[] = [];
    eventBus.on('session.workflow.failed', (p) => failed.push(p as { tokensUsed?: unknown }));
    const adapter = new AgentSdkSessionAdapter(eventBus, {}, queryFn);

    const handle = await adapter.startSession('/bmad-bmm-dev-story', makeContext());

    expect(handle.firstTurn.error).toBe(true);
    expect(handle.firstTurn.errorMessage).toContain('tool_use');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.tokensUsed).toBe(150);
  });

  it('should intercept AskUserQuestion via canUseTool and route to QuestionHandler', async () => {
    let interceptedInput: unknown;
    const questionHandler: QuestionHandler = async (_toolName, input) => {
      interceptedInput = input;
      return {
        behavior: 'allow' as const,
        updatedInput: { questions: ['Pick one'], answers: { 'Pick one': 'Option A' } },
      };
    };

    let capturedCanUseTool: ((...args: unknown[]) => Promise<unknown>) | undefined;

    const queryFn: QueryFunction = (params) => {
      const opts = params.options as Record<string, unknown>;
      capturedCanUseTool = opts.canUseTool as (...args: unknown[]) => Promise<unknown>;
      return (async function* () {
        yield makeResultSuccess('done');
      })();
    };

    const adapter = new AgentSdkSessionAdapter(undefined, { questionHandler }, queryFn);

    await adapter.startSession('/test', makeContext());

    // Simulate SDK calling canUseTool with AskUserQuestion
    expect(capturedCanUseTool).toBeDefined();
    const askInput = { questions: ['Pick one'] };
    const result = await capturedCanUseTool?.('AskUserQuestion', askInput, {
      signal: new AbortController().signal,
      toolUseID: 'tu-1',
    });

    expect(interceptedInput).toEqual(askInput);
    expect(result).toEqual({
      behavior: 'allow',
      updatedInput: { questions: ['Pick one'], answers: { 'Pick one': 'Option A' } },
    });
  });

  it('should auto-approve non-AskUserQuestion tools via canUseTool', async () => {
    let capturedCanUseTool: ((...args: unknown[]) => Promise<unknown>) | undefined;

    const queryFn: QueryFunction = (params) => {
      const opts = params.options as Record<string, unknown>;
      capturedCanUseTool = opts.canUseTool as (...args: unknown[]) => Promise<unknown>;
      return (async function* () {
        yield makeResultSuccess('done');
      })();
    };

    const adapter = new AgentSdkSessionAdapter(undefined, {}, queryFn);
    await adapter.startSession('/test', makeContext());

    const bashInput = { command: 'ls' };
    const result = await capturedCanUseTool?.('Bash', bashInput, {
      signal: new AbortController().signal,
      toolUseID: 'tu-2',
    });

    expect(result).toEqual({ behavior: 'allow', updatedInput: bashInput });
  });

  it('should continue a session with resume option using SDK session_id', async () => {
    const sdkSessionId = 'sdk-session-abc';
    // First call: startSession captures SDK session_id from messages
    const startMessages = [
      makeAssistantMessage('started', sdkSessionId),
      makeResultSuccess('first done', sdkSessionId),
    ];
    // Second call: continueSession should use the captured SDK session_id
    const resumeMessages = [makeResultSuccess('continued', sdkSessionId)];

    let callCount = 0;
    const captured: { prompt: string; options: unknown }[] = [];
    const queryFn: QueryFunction = (params) => {
      captured.push({ prompt: params.prompt, options: params.options });
      const msgs = callCount === 0 ? startMessages : resumeMessages;
      callCount++;
      return (async function* () {
        for (const msg of msgs) {
          yield msg;
        }
      })();
    };

    const adapter = new AgentSdkSessionAdapter(undefined, {}, queryFn);

    const handle = await adapter.startSession('/test', makeContext());
    const result = await adapter.continueSession(handle.sessionId, 'continue please');

    expect(captured).toHaveLength(2);
    expect(captured[1]?.prompt).toBe('continue please');
    const opts = captured[1]?.options as Record<string, unknown>;
    // resume should use the SDK's session_id, not the adapter's UUID
    expect(opts.resume).toBe(sdkSessionId);
    expect(opts.cwd).toBe('/tmp/test-project');
    expect(result.completed).toBe(true);
    expect(result.output).toBe('continued');
  });

  it('should handle SDK errors and return error SessionTurnResult', async () => {
    const queryFn: QueryFunction = (_params) => ({
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<SDKMessage>> {
            throw new Error('SDK connection failed');
          },
        };
      },
    });

    eventBus = new EventBus();
    const events: { type: string; payload: unknown }[] = [];
    eventBus.on('session.workflow.failed', (payload) => {
      events.push({ type: 'session.workflow.failed', payload });
    });

    const adapter = new AgentSdkSessionAdapter(eventBus, {}, queryFn);
    const handle = await adapter.startSession('/test', makeContext());

    expect(handle.firstTurn.completed).toBe(true);
    expect(handle.firstTurn.error).toBe(true);
    expect(handle.firstTurn.errorMessage).toBe('SDK connection failed');
    expect(events).toHaveLength(1);
  });

  it('should handle maxTurns exceeded error result', async () => {
    const queryFn = createMockQuery([
      makeAssistantMessage('partial output'),
      makeResultError('error_max_turns', ['Max turns exceeded']),
    ]);

    const adapter = new AgentSdkSessionAdapter(undefined, {}, queryFn);
    const handle = await adapter.startSession('/test', makeContext());

    expect(handle.firstTurn.completed).toBe(true);
    expect(handle.firstTurn.error).toBe(true);
    expect(handle.firstTurn.errorMessage).toContain('Max turns exceeded');
  });

  it('should handle SDK crash mid-iteration (AsyncGenerator throw)', async () => {
    let yieldCount = 0;
    const queryFn: QueryFunction = (_params) => {
      return (async function* () {
        yield makeAssistantMessage('partial');
        yieldCount++;
        throw new Error('AsyncGenerator crashed mid-stream');
      })();
    };

    eventBus = new EventBus();
    const adapter = new AgentSdkSessionAdapter(eventBus, {}, queryFn);
    const handle = await adapter.startSession('/test', makeContext());

    expect(yieldCount).toBe(1);
    expect(handle.firstTurn.completed).toBe(true);
    expect(handle.firstTurn.error).toBe(true);
    expect(handle.firstTurn.errorMessage).toBe('AsyncGenerator crashed mid-stream');
  });

  it('should treat a crash after a success result as completed and still credit tokens (ADR-017 + teardown)', async () => {
    // A success result arrives (recording 150 tokens), then the stream crashes.
    // The session's work already succeeded, so the adapter reports it completed
    // (not failed) and still credits the budget — now via the completed event,
    // which the orchestrator also subscribes for budget accounting.
    const queryFn: QueryFunction = (_params) => {
      return (async function* () {
        yield makeResultSuccess('partial');
        throw new Error('crash after result');
      })();
    };
    eventBus = new EventBus();
    const completed: { tokensUsed?: unknown }[] = [];
    const failed: unknown[] = [];
    eventBus.on('session.workflow.completed', (p) => completed.push(p as { tokensUsed?: unknown }));
    eventBus.on('session.workflow.failed', (p) => failed.push(p));
    const adapter = new AgentSdkSessionAdapter(eventBus, {}, queryFn);

    const handle = await adapter.startSession('/test', makeContext());

    expect(handle.firstTurn.error).toBeUndefined();
    expect(handle.firstTurn.completed).toBe(true);
    expect(failed).toHaveLength(0);
    expect(completed).toHaveLength(1);
    expect(completed[0]?.tokensUsed).toBe(150);
  });

  it('should treat a non-zero process exit AFTER a success result as success (teardown quirk)', async () => {
    // Reproduces the real BMAD-session bug: result:success is yielded, then the
    // Claude Code CLI subprocess exits 1 during teardown and the SDK throws.
    // Without this guard, an otherwise-green story is flipped to failed and the
    // run escalates + aborts. The error is recorded for observability.
    const queryFn: QueryFunction = (_params) => {
      return (async function* () {
        yield makeAssistantMessage('did the work');
        yield makeResultSuccess('Story created');
        throw new Error('Claude Code process exited with code 1');
      })();
    };
    eventBus = new EventBus();
    const completed: { teardownExitIgnored?: unknown }[] = [];
    eventBus.on('session.workflow.completed', (p) =>
      completed.push(p as { teardownExitIgnored?: unknown }),
    );
    const adapter = new AgentSdkSessionAdapter(eventBus, {}, queryFn);

    const handle = await adapter.startSession('/bmad-bmm-create-story', makeContext());

    expect(handle.firstTurn.completed).toBe(true);
    expect(handle.firstTurn.error).toBeUndefined();
    expect(handle.firstTurn.output).toBe('Story created');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.teardownExitIgnored).toBe('Claude Code process exited with code 1');
  });

  it('should emit correct events on successful session lifecycle', async () => {
    const queryFn = createMockQuery([
      makeAssistantMessage('Working...'),
      makeResultSuccess('All done'),
    ]);

    eventBus = new EventBus();
    const events: { type: string; payload: unknown }[] = [];
    eventBus.on('session.started', (p) => events.push({ type: 'session.started', payload: p }));
    eventBus.on('session.turn.completed', (p) =>
      events.push({ type: 'session.turn.completed', payload: p }),
    );
    eventBus.on('session.workflow.completed', (p) =>
      events.push({ type: 'session.workflow.completed', payload: p }),
    );

    const adapter = new AgentSdkSessionAdapter(eventBus, {}, queryFn);
    const handle = await adapter.startSession('/dev-story', makeContext({ storyId: 'EA9-S1' }));

    expect(handle.firstTurn.completed).toBe(true);
    // session.started + session.turn.completed (per turn) + session.workflow.completed
    expect(events).toHaveLength(3);
    expect(events[0]?.type).toBe('session.started');
    expect((events[0]?.payload as Record<string, unknown>).storyId).toBe('EA9-S1');
    expect(events[1]?.type).toBe('session.turn.completed');
    expect((events[1]?.payload as Record<string, unknown>).turn).toBe(1);
    expect(events[2]?.type).toBe('session.workflow.completed');
    expect((events[2]?.payload as Record<string, unknown>).storyId).toBe('EA9-S1');
  });

  it('should use default question handler that auto-answers C when none provided', async () => {
    let capturedCanUseTool: ((...args: unknown[]) => Promise<unknown>) | undefined;

    const queryFn: QueryFunction = (params) => {
      const opts = params.options as Record<string, unknown>;
      capturedCanUseTool = opts.canUseTool as (...args: unknown[]) => Promise<unknown>;
      return (async function* () {
        yield makeResultSuccess('done');
      })();
    };

    // No questionHandler provided — default should auto-answer "C"
    const adapter = new AgentSdkSessionAdapter(undefined, undefined, queryFn);
    await adapter.startSession('/test', makeContext());

    const askInput = { questions: ['Continue?', 'Pick option'] };
    const result = await capturedCanUseTool?.('AskUserQuestion', askInput, {
      signal: new AbortController().signal,
      toolUseID: 'tu-3',
    });

    expect(result).toEqual({
      behavior: 'allow',
      updatedInput: {
        questions: ['Continue?', 'Pick option'],
        answers: { 'Continue?': 'C', 'Pick option': 'C' },
      },
    });
  });

  it('should capture SDK session_id from first message with session_id field', async () => {
    const sdkId = 'sdk-real-session-42';
    const queryFn = createMockQuery([
      makeAssistantMessage('hello', sdkId),
      makeResultSuccess('done', sdkId),
    ]);

    const adapter = new AgentSdkSessionAdapter(undefined, {}, queryFn);
    const handle = await adapter.startSession('/test', makeContext());

    // The adapter's sessionId is a UUID, different from the SDK's
    expect(handle.sessionId).not.toBe(sdkId);
    expect(handle.firstTurn.completed).toBe(true);

    // Resume behavior is verified in the "should continue a session..." test
  });

  it('should handle continueSession with unknown sessionId gracefully', async () => {
    const captured: { prompt: string; options: unknown }[] = [];
    const queryFn: QueryFunction = (params) => {
      captured.push({ prompt: params.prompt, options: params.options });
      return (async function* () {
        yield makeResultSuccess('ok');
      })();
    };

    const adapter = new AgentSdkSessionAdapter(undefined, {}, queryFn);
    const result = await adapter.continueSession('non-existent-session-id', 'hello');

    // Should still work — no resume option, no cwd since context is unknown
    expect(captured).toHaveLength(1);
    const opts = captured[0]?.options as Record<string, unknown>;
    expect(opts.resume).toBeUndefined();
    expect(opts.cwd).toBeUndefined();
    expect(result.completed).toBe(true);
    expect(result.output).toBe('ok');
  });

  it('should forward disallowedTools into the SDK options when provided (ADR-018)', async () => {
    const { queryFn, captured } = createCapturingQuery([makeResultSuccess('ok')]);
    const disallowedTools = ['Bash(rm *)', 'Bash(git reset --hard *)', 'Bash(git clean *)'];
    const adapter = new AgentSdkSessionAdapter(undefined, { disallowedTools }, queryFn);

    await adapter.startSession('/test', makeContext());

    const opts = captured[0]?.options as Record<string, unknown>;
    expect(opts.disallowedTools).toEqual(disallowedTools);
  });

  it('should omit disallowedTools from SDK options when not provided (ADR-018)', async () => {
    const { queryFn, captured } = createCapturingQuery([makeResultSuccess('ok')]);
    const adapter = new AgentSdkSessionAdapter(undefined, {}, queryFn);

    await adapter.startSession('/test', makeContext());

    const opts = captured[0]?.options as Record<string, unknown>;
    expect('disallowedTools' in opts).toBe(false);
  });

  it('should NOT pass permissionMode dontAsk (would bypass canUseTool / AskUserQuestion) (ADR-018)', async () => {
    const { queryFn, captured } = createCapturingQuery([makeResultSuccess('ok')]);
    const adapter = new AgentSdkSessionAdapter(
      undefined,
      { disallowedTools: ['Bash(rm *)'] },
      queryFn,
    );

    await adapter.startSession('/test', makeContext());

    const opts = captured[0]?.options as Record<string, unknown>;
    expect(opts.permissionMode).toBeUndefined();
    expect(opts.canUseTool).toBeDefined();
  });

  it('should deny a destructive Bash command via canUseTool defensive guard (ADR-018)', async () => {
    let capturedCanUseTool: ((...args: unknown[]) => Promise<unknown>) | undefined;
    const queryFn: QueryFunction = (params) => {
      const opts = params.options as Record<string, unknown>;
      capturedCanUseTool = opts.canUseTool as (...args: unknown[]) => Promise<unknown>;
      return (async function* () {
        yield makeResultSuccess('done');
      })();
    };

    const adapter = new AgentSdkSessionAdapter(undefined, {}, queryFn);
    await adapter.startSession('/test', makeContext());

    const callOptions = { signal: new AbortController().signal, toolUseID: 'tu-rm' };
    for (const command of [
      'rm -rf /',
      'sudo rm -rf /tmp/x',
      'git reset --hard HEAD~1',
      'git clean -fd',
    ]) {
      const result = (await capturedCanUseTool?.('Bash', { command }, callOptions)) as {
        behavior: string;
        message?: string;
      };
      expect(result.behavior).toBe('deny');
      expect(result.message).toBeDefined();
    }
    // Narrowed (item 5): single-file `rm` and package-manager subcommands are allowed.
    for (const command of ['rm somefile', 'npm rm left-pad']) {
      const result = (await capturedCanUseTool?.('Bash', { command }, callOptions)) as {
        behavior: string;
      };
      expect(result.behavior).toBe('allow');
    }
  });

  it('should still allow a benign Bash command despite the defensive guard (ADR-018)', async () => {
    let capturedCanUseTool: ((...args: unknown[]) => Promise<unknown>) | undefined;
    const queryFn: QueryFunction = (params) => {
      const opts = params.options as Record<string, unknown>;
      capturedCanUseTool = opts.canUseTool as (...args: unknown[]) => Promise<unknown>;
      return (async function* () {
        yield makeResultSuccess('done');
      })();
    };

    const adapter = new AgentSdkSessionAdapter(undefined, {}, queryFn);
    await adapter.startSession('/test', makeContext());

    const benignInput = { command: 'ls -la' };
    const result = await capturedCanUseTool?.('Bash', benignInput, {
      signal: new AbortController().signal,
      toolUseID: 'tu-ls',
    });

    expect(result).toEqual({ behavior: 'allow', updatedInput: benignInput });
  });

  it('should still intercept AskUserQuestion after adding the defensive Bash guard (ADR-018)', async () => {
    let interceptedInput: unknown;
    const questionHandler: QuestionHandler = async (_toolName, input) => {
      interceptedInput = input;
      return {
        behavior: 'allow' as const,
        updatedInput: { questions: ['Q'], answers: { Q: 'A' } },
      };
    };
    let capturedCanUseTool: ((...args: unknown[]) => Promise<unknown>) | undefined;
    const queryFn: QueryFunction = (params) => {
      const opts = params.options as Record<string, unknown>;
      capturedCanUseTool = opts.canUseTool as (...args: unknown[]) => Promise<unknown>;
      return (async function* () {
        yield makeResultSuccess('done');
      })();
    };

    const adapter = new AgentSdkSessionAdapter(
      undefined,
      { questionHandler, disallowedTools: ['Bash(rm *)'] },
      queryFn,
    );
    await adapter.startSession('/test', makeContext());

    const askInput = { questions: ['Q'] };
    const result = await capturedCanUseTool?.('AskUserQuestion', askInput, {
      signal: new AbortController().signal,
      toolUseID: 'tu-ask',
    });

    expect(interceptedInput).toEqual(askInput);
    expect(result).toEqual({
      behavior: 'allow',
      updatedInput: { questions: ['Q'], answers: { Q: 'A' } },
    });
  });

  it('should preserve context (cwd, storyId) across continueSession calls', async () => {
    const captured: { prompt: string; options: unknown }[] = [];
    const queryFn: QueryFunction = (params) => {
      captured.push({ prompt: params.prompt, options: params.options });
      return (async function* () {
        yield makeAssistantMessage('msg', 'sdk-s1');
        yield makeResultSuccess('ok', 'sdk-s1');
      })();
    };

    eventBus = new EventBus();
    const events: { type: string; payload: unknown }[] = [];
    eventBus.on('session.workflow.completed', (p) =>
      events.push({ type: 'session.workflow.completed', payload: p }),
    );

    const adapter = new AgentSdkSessionAdapter(eventBus, {}, queryFn);
    const handle = await adapter.startSession('/test', makeContext({ storyId: 'EA9-S1' }));
    await adapter.continueSession(handle.sessionId, 'next');

    // continueSession should preserve cwd from original context
    const resumeOpts = captured[1]?.options as Record<string, unknown>;
    expect(resumeOpts.cwd).toBe('/tmp/test-project');

    // Events from continueSession should have storyId
    expect(events).toHaveLength(2);
    expect((events[1]?.payload as Record<string, unknown>).storyId).toBe('EA9-S1');
  });
});
