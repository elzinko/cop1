import { randomUUID } from 'node:crypto';
import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { EventBus } from '@cop1/shared-kernel';
import type { ModelTier, ModelTierRouter } from '../domain/ModelTierRouter.js';
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
}

/**
 * Patterns that must never run unattended inside a story worktree (ADR-018).
 * Belt-and-braces with `disallowedTools`: `canUseTool` denies these defensively.
 */
const DESTRUCTIVE_BASH_PATTERNS: readonly RegExp[] = [
  /\brm\s+-rf\b/,
  /\brm\s+/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\b/,
];

/** Returns true when a Bash command matches a known destructive pattern. */
function isDestructiveBashCommand(command: string): boolean {
  return DESTRUCTIVE_BASH_PATTERNS.some((pattern) => pattern.test(command));
}

/** Injectable query function type, matching the SDK's query() signature for testability. */
export type QueryFunction = (params: {
  prompt: string;
  options?: Options;
}) => AsyncIterable<SDKMessage> & { session_id?: string };

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

  private async executeQuery(
    sessionId: string,
    prompt: string,
    context: BMADSessionContext | undefined,
    startTime: number,
    isResume: boolean,
  ): Promise<SessionTurnResult> {
    const questionHandler = this.questionHandler;
    const sdkSessionId = isResume ? this.sdkSessionIds.get(sessionId) : undefined;
    const model = this.sessionModels.get(sessionId);

    const options: Options = {
      systemPrompt: { type: 'preset', preset: 'claude_code' },
      settingSources: ['project'],
      allowedTools: ['Skill', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      tools: ['Skill', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'AskUserQuestion'],
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

    try {
      const iterable = this.queryFn({ prompt, options });
      let output = '';
      let completed = false;
      let tokensUsed: number | undefined;
      let turn = 0;

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

          if (message.subtype === 'success') {
            output = message.result || output;
          } else {
            const durationMs = Date.now() - startTime;
            const errorMessages = 'errors' in message ? message.errors : [];
            const errorMsg = errorMessages.join('; ') || `Session ended with: ${message.subtype}`;

            this.eventBus?.emit('session.workflow.failed', {
              sessionId,
              storyId: context?.storyId,
              error: errorMsg,
              turn,
            });

            return {
              completed: true,
              output: errorMsg,
              error: true,
              errorMessage: errorMsg,
              tokensUsed,
              durationMs,
            };
          }
        }
      }

      const durationMs = Date.now() - startTime;

      if (completed) {
        this.eventBus?.emit('session.workflow.completed', {
          sessionId,
          storyId: context?.storyId,
          totalTurns: turn,
          totalDurationMs: durationMs,
          tokensUsed,
        });
      }

      return {
        completed,
        output,
        tokensUsed,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.eventBus?.emit('session.workflow.failed', {
        sessionId,
        storyId: context?.storyId,
        error: errorMsg,
        turn: 0,
      });

      return {
        completed: true,
        output: errorMsg,
        error: true,
        errorMessage: errorMsg,
        durationMs,
      };
    }
  }
}
