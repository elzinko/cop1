import { randomUUID } from 'node:crypto';
import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { EventBus } from '@cop1/shared-kernel';
import { CLAUDE_STATUS_EVENT, type ClaudeAvailability } from '../domain/ClaudeAvailability.js';
import type { ModelTier, ModelTierRouter } from '../domain/ModelTierRouter.js';
import { RetryPolicy } from '../domain/RetryPolicy.js';
import type {
  BMADSessionContext,
  BMADSessionPort,
  QuestionHandler,
  SessionHandle,
  SessionTurnResult,
} from '../domain/ports/BMADSessionPort.js';

export interface AgentSdkSessionAdapterOptions {
  /** Maximum number of agentic turns per session (default: 30). */
  maxTurns?: number;
  /** Maximum budget in USD per session (optional). */
  maxBudgetUsd?: number;
  /** Question handler for intercepted AskUserQuestion tool calls. */
  questionHandler?: QuestionHandler;
  /** Optional policy mapping a BMAD command to a Claude model tier (per session). */
  modelRouter?: ModelTierRouter;
  /**
   * Tool-permission denylist forwarded to the SDK `Options.disallowedTools`
   * (ADR-018 guardrails). Paired with a defensive `canUseTool` deny — we never
   * set `permissionMode: 'dontAsk'`, which would bypass `canUseTool` and break
   * AskUserQuestion supervisor interception.
   */
  disallowedTools?: string[];
  /**
   * Retry policy for *transient* Claude blockages (overloaded / rate-limit /
   * 5xx / network). Defaults to `new RetryPolicy()`. A failed attempt whose
   * error matches `isTransientError` is retried with exponential backoff.
   */
  retryPolicy?: RetryPolicy;
  /** Injectable backoff sleep (default: real `setTimeout`). Overridden in tests. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Patterns that must never run unattended inside a story worktree (ADR-018).
 * Belt-and-braces with `disallowedTools`: `canUseTool` denies these defensively.
 */
const DESTRUCTIVE_BASH_PATTERNS: readonly RegExp[] = [
  // `rm` with a recursive flag (-r, -rf, -fr, -Rf…). Single-file `rm <file>` and
  // package-manager subcommands such as `npm rm` / `pnpm rm <pkg>` carry no
  // recursive flag, so they are not matched (worktree isolation covers them).
  /\brm\s+-[a-z]*r/i,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\b/,
];

/** Returns true when a Bash command matches a known destructive pattern. */
export function isDestructiveBashCommand(command: string): boolean {
  return DESTRUCTIVE_BASH_PATTERNS.some((pattern) => pattern.test(command));
}

/** Injectable query function type, matching the SDK's query() signature for testability. */
export type QueryFunction = (params: {
  prompt: string;
  options?: Options;
}) => AsyncIterable<SDKMessage> & { session_id?: string };

/**
 * Result of a single query attempt (no terminal events, no retry) — the
 * retry wrapper interprets this to decide success / retry / terminal failure.
 */
type QueryAttemptOutcome =
  | { ok: true; result: SessionTurnResult; turn: number; teardownExitIgnored?: string }
  | { ok: false; errorMsg: string; turn: number; tokensUsed?: number; durationMs: number };

/**
 * Default question handler: auto-answers "C" (continue) for all questions.
 * Adds `answers` map with "C" for each question, per AskUserQuestion protocol.
 */
const defaultQuestionHandler: QuestionHandler = async (_toolName, input) => {
  const payload = input as Record<string, unknown>;
  const questions = Array.isArray(payload.questions) ? (payload.questions as string[]) : [];
  const answers: Record<string, string> = {};
  for (const q of questions) {
    answers[q] = 'C';
  }
  return {
    behavior: 'allow' as const,
    updatedInput: { ...payload, answers },
  };
};

export class AgentSdkSessionAdapter implements BMADSessionPort {
  private readonly eventBus?: EventBus;
  private readonly maxTurns: number;
  private readonly maxBudgetUsd?: number;
  private readonly questionHandler: QuestionHandler;
  private readonly queryFn: QueryFunction;
  /** Maps adapter sessionId → SDK session_id captured from message stream. */
  private readonly sdkSessionIds = new Map<string, string>();
  /** Stores session context for reuse in continueSession. */
  private readonly sessionContexts = new Map<string, BMADSessionContext>();
  /** Resolves the Claude model tier per command (optional; omitted → SDK default). */
  private readonly modelRouter?: ModelTierRouter;
  /** Maps adapter sessionId → resolved model tier, reused across follow-up turns. */
  private readonly sessionModels = new Map<string, ModelTier>();
  /** SDK tool denylist (ADR-018 guardrails); omitted from Options when undefined. */
  private readonly disallowedTools?: string[];
  /** Retry policy for transient Claude blockages (overloaded / 5xx / network). */
  private readonly retryPolicy: RetryPolicy;
  /** Backoff sleep between retries; injectable so tests run without real delays. */
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    eventBus?: EventBus,
    options?: AgentSdkSessionAdapterOptions,
    queryFn?: QueryFunction,
  ) {
    this.eventBus = eventBus;
    this.maxTurns = options?.maxTurns ?? 30;
    this.maxBudgetUsd = options?.maxBudgetUsd;
    this.questionHandler = options?.questionHandler ?? defaultQuestionHandler;
    this.modelRouter = options?.modelRouter;
    this.disallowedTools = options?.disallowedTools;
    this.retryPolicy = options?.retryPolicy ?? new RetryPolicy();
    this.sleep = options?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.queryFn = queryFn ?? AgentSdkSessionAdapter.loadSdkQuery();
  }

  private static loadSdkQuery(): QueryFunction {
    let cached: QueryFunction | undefined;
    return (params) => {
      if (!cached) {
        const promise = import('@anthropic-ai/claude-agent-sdk').then((sdk) => sdk.query);
        return (async function* lazyProxy() {
          const sdkQuery = await promise;
          cached = sdkQuery as QueryFunction;
          yield* sdkQuery(params) as AsyncIterable<SDKMessage>;
        })();
      }
      return cached(params);
    };
  }

  /**
   * EA12-S2 — recovery accessor. Retrieves the SDK-assigned session_id bound to
   * a local sessionId. Callers persist this id between crashes and hand it back
   * to `restoreSession` on a fresh adapter instance.
   */
  getSdkSessionId(localSessionId: string): string | undefined {
    return this.sdkSessionIds.get(localSessionId);
  }

  /**
   * EA12-S2 — recovery entrypoint. Primes a fresh adapter with a previously
   * captured SDK session_id so subsequent `continueSession` calls pass
   * `resume: sdkSessionId` to the SDK query. Returns a new local sessionId.
   */
  restoreSession(sdkSessionId: string, context: BMADSessionContext): string {
    const sessionId = randomUUID();
    this.sessionContexts.set(sessionId, context);
    this.sdkSessionIds.set(sessionId, sdkSessionId);
    this.eventBus?.emit('session.restored', {
      sessionId,
      sdkSessionId,
      storyId: context.storyId,
      timestamp: new Date().toISOString(),
    });
    return sessionId;
  }

  async startSession(command: string, context: BMADSessionContext): Promise<SessionHandle> {
    const sessionId = randomUUID();
    const startTime = Date.now();

    this.sessionContexts.set(sessionId, context);
    if (this.modelRouter) {
      this.sessionModels.set(sessionId, this.modelRouter.resolve(command));
    }

    this.eventBus?.emit('session.started', {
      sessionId,
      command,
      storyId: context.storyId,
      timestamp: new Date().toISOString(),
    });

    const firstTurn = await this.executeQuery(sessionId, command, context, startTime, false);

    return { sessionId, firstTurn };
  }

  async continueSession(sessionId: string, message: string): Promise<SessionTurnResult> {
    const startTime = Date.now();
    const context = this.sessionContexts.get(sessionId);
    return this.executeQuery(sessionId, message, context, startTime, true);
  }

  /**
   * Retry wrapper around {@link runQueryAttempt}. On a *transient* failure
   * (overloaded / rate-limit / 5xx / network — see {@link RetryPolicy}) it
   * retries with exponential backoff, emitting `claude.status` so a temporary
   * Claude blockage is observable instead of silent. Success or a non-transient
   * failure returns immediately. Terminal `session.workflow.*` events are
   * emitted here, exactly once per turn.
   */
  private async executeQuery(
    sessionId: string,
    prompt: string,
    context: BMADSessionContext | undefined,
    startTime: number,
    isResume: boolean,
  ): Promise<SessionTurnResult> {
    for (let attempt = 0; ; attempt++) {
      const a = await this.runQueryAttempt(sessionId, prompt, context, startTime, isResume);

      if (a.ok) {
        if (a.result.completed) {
          this.eventBus?.emit('session.workflow.completed', {
            sessionId,
            storyId: context?.storyId,
            totalTurns: a.turn,
            totalDurationMs: a.result.durationMs,
            tokensUsed: a.result.tokensUsed,
            ...(a.teardownExitIgnored ? { teardownExitIgnored: a.teardownExitIgnored } : {}),
          });
          // Recovered after one or more transient retries.
          if (attempt > 0) this.emitClaudeStatus('ok', attempt, sessionId, context);
        }
        return a.result;
      }

      const transient = this.retryPolicy.isTransientError(a.errorMsg);
      if (transient && attempt < this.retryPolicy.maxRetries) {
        this.emitClaudeStatus('degraded', attempt + 1, sessionId, context, a.errorMsg);
        await this.sleep(this.retryPolicy.getDelayMs(attempt));
        continue;
      }
      if (transient)
        this.emitClaudeStatus('unavailable', attempt + 1, sessionId, context, a.errorMsg);

      this.eventBus?.emit('session.workflow.failed', {
        sessionId,
        storyId: context?.storyId,
        error: a.errorMsg,
        turn: a.turn,
        tokensUsed: a.tokensUsed,
      });
      return {
        completed: true,
        output: a.errorMsg,
        error: true,
        errorMessage: a.errorMsg,
        tokensUsed: a.tokensUsed,
        durationMs: a.durationMs,
      };
    }
  }

  /** Emits a {@link ClaudeStatusEvent} on the bus (no-op without an eventBus). */
  private emitClaudeStatus(
    status: ClaudeAvailability,
    attempt: number,
    sessionId: string,
    context: BMADSessionContext | undefined,
    detail?: string,
  ): void {
    this.eventBus?.emit(CLAUDE_STATUS_EVENT, {
      status,
      attempt,
      ...(detail ? { detail: detail.slice(0, 300) } : {}),
      sessionId,
      storyId: context?.storyId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Runs ONE query attempt. Emits per-turn telemetry only; the caller
   * ({@link executeQuery}) owns terminal events and retry decisions. Never
   * throws — a thrown SDK error becomes an `{ ok: false }` outcome.
   */
  private async runQueryAttempt(
    sessionId: string,
    prompt: string,
    context: BMADSessionContext | undefined,
    startTime: number,
    isResume: boolean,
  ): Promise<QueryAttemptOutcome> {
    const questionHandler = this.questionHandler;
    const sdkSessionId = isResume ? this.sdkSessionIds.get(sessionId) : undefined;
    const model = this.sessionModels.get(sessionId);

    const options: Options = {
      systemPrompt: { type: 'preset', preset: 'claude_code' },
      settingSources: ['project'],
      // Built-in tool permits. `AskUserQuestion` is included so the supervisor
      // interception (via `canUseTool`) is reachable. NB: the SDK `tools` option
      // is for *custom* MCP tool definitions (objects), NOT built-in tool-name
      // strings — passing names there is a no-op at best, so it is omitted.
      allowedTools: ['Skill', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'AskUserQuestion'],
      maxTurns: this.maxTurns,
      ...(model ? { model } : {}),
      ...(this.maxBudgetUsd !== undefined && { maxBudgetUsd: this.maxBudgetUsd }),
      ...(this.disallowedTools ? { disallowedTools: this.disallowedTools } : {}),
      ...(context?.projectPath && { cwd: context.projectPath }),
      ...(isResume && sdkSessionId ? { resume: sdkSessionId } : {}),
      canUseTool: async (toolName, input, _callOptions) => {
        if (toolName === 'AskUserQuestion') {
          return questionHandler(toolName, input);
        }
        // ADR-018 defensive guard: deny destructive Bash commands even if a
        // disallowedTools entry is missing or mis-typed (belt-and-braces).
        if (toolName === 'Bash') {
          const command = (input as { command?: unknown }).command;
          if (typeof command === 'string' && isDestructiveBashCommand(command)) {
            return {
              behavior: 'deny',
              message: `Destructive command blocked by ADR-018 guardrail: ${command}`,
            };
          }
        }
        return { behavior: 'allow', updatedInput: input as Record<string, unknown> };
      },
    };

    // Declared outside the try so the catch block can still credit any tokens
    // recorded before a mid-stream crash (ADR-017 budget accounting) and detect
    // a successful result that arrived before a teardown-only process exit.
    let tokensUsed: number | undefined;
    let output = '';
    let completed = false;
    let turn = 0;
    // True once a `result` message with subtype `success` has been observed.
    // The Claude Code CLI subprocess can still exit non-zero during teardown
    // *after* a successful result (MCP/hook cleanup, telemetry flush). That
    // post-success exit must NOT flip a completed session to failed.
    let sawSuccessResult = false;

    try {
      const iterable = this.queryFn({ prompt, options });

      for await (const message of iterable) {
        // Capture SDK session_id from the first message that carries one
        if (!this.sdkSessionIds.has(sessionId)) {
          const msgAny = message as Record<string, unknown>;
          if (typeof msgAny.session_id === 'string') {
            this.sdkSessionIds.set(sessionId, msgAny.session_id);
          }
        }

        if (message.type === 'assistant') {
          const contentBlocks = message.message.content;
          for (const block of contentBlocks) {
            if ('text' in block && typeof block.text === 'string') {
              output += block.text;
            }
          }
          turn++;

          this.eventBus?.emit('session.turn.completed', {
            sessionId,
            turn,
            durationMs: Date.now() - startTime,
            tokensUsed: undefined,
          });
        }

        if (message.type === 'result') {
          completed = true;
          tokensUsed = message.usage
            ? message.usage.input_tokens + message.usage.output_tokens
            : undefined;

          // A result can carry subtype `success` yet `is_error: true` when the
          // agent surfaced an API error (e.g. a 4xx/5xx, rate limit) as its
          // final answer. Treat that as a failed session, never a false success.
          const isErrorResult = (message as { is_error?: boolean }).is_error === true;

          if (message.subtype === 'success' && !isErrorResult) {
            sawSuccessResult = true;
            output = message.result || output;
          } else {
            const durationMs = Date.now() - startTime;
            const errorMessages = 'errors' in message ? message.errors : [];
            const resultText =
              typeof (message as { result?: unknown }).result === 'string'
                ? ((message as { result?: string }).result as string)
                : undefined;
            const errorMsg =
              errorMessages.join('; ') || resultText || `Session ended with: ${message.subtype}`;

            return { ok: false, errorMsg, turn, tokensUsed, durationMs };
          }
        }
      }

      const durationMs = Date.now() - startTime;
      return { ok: true, result: { completed, output, tokensUsed, durationMs }, turn };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Known Claude Code CLI quirk: the subprocess can exit non-zero during
      // teardown *after* emitting a successful result. The session's work is
      // done and was reported as success, so honor that rather than letting the
      // teardown exit flip a completed story to `failed` (which would escalate
      // and abort an otherwise-green run). See AgentSdkSessionAdapter tests.
      if (sawSuccessResult) {
        return {
          ok: true,
          result: { completed: true, output, tokensUsed, durationMs },
          turn,
          teardownExitIgnored: errorMsg,
        };
      }

      return { ok: false, errorMsg, turn, tokensUsed, durationMs };
    }
  }
}
