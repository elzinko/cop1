import { buildSupervisorPrompt } from '../domain/SupervisorPromptBuilder.js';
import { SupervisorRateLimitError } from '../domain/errors/SupervisorRateLimitError.js';
import { SupervisorTimeoutError } from '../domain/errors/SupervisorTimeoutError.js';
import type {
  SupervisorLLMPort,
  SupervisorQuestion,
  SupervisorQuestionContext,
  SupervisorResponse,
} from '../domain/ports/SupervisorLLMPort.js';

/** Shape of a single message yielded by the Agent SDK query function. */
export interface SupervisorQueryMessage {
  type: string;
  text?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

/** Query options passed to the Agent SDK. */
export interface SupervisorQueryOptions {
  prompt: string;
  options: {
    allowedTools: string[];
    maxTurns: number;
  };
}

/**
 * Injectable query function matching the Agent SDK `query()` signature.
 * Yields messages as an async iterable.
 */
export type SupervisorQueryFunction = (
  options: SupervisorQueryOptions,
) => AsyncIterable<SupervisorQueryMessage>;

const ESCALATE_PREFIX = 'ESCALATE:';

/**
 * Adapter that spawns a separate Claude Agent SDK session for each supervisor call.
 * Single-turn, no tools, prompt-only.
 */
export class AgentSdkSupervisorAdapter implements SupervisorLLMPort {
  private readonly queryFn: SupervisorQueryFunction;

  constructor(queryFn?: SupervisorQueryFunction) {
    this.queryFn = queryFn ?? AgentSdkSupervisorAdapter.loadSdkQuery();
  }

  /**
   * Lazily loads the real Agent SDK `query()` and adapts it to
   * `SupervisorQueryFunction`. Mirrors `AgentSdkSessionAdapter.loadSdkQuery()`
   * so callers in the composition root do not need to hand-roll a dynamic
   * import wrapper.
   */
  private static loadSdkQuery(): SupervisorQueryFunction {
    return async function* lazySupervisorQuery(params) {
      const sdk = (await import('@anthropic-ai/claude-agent-sdk')) as unknown as {
        query: (q: {
          prompt: string;
          options: {
            systemPrompt: { type: 'preset'; preset: 'claude_code' };
            allowedTools: string[];
            maxTurns: number;
          };
        }) => AsyncIterable<Record<string, unknown>>;
      };
      const iterable = sdk.query({
        prompt: params.prompt,
        options: {
          systemPrompt: { type: 'preset', preset: 'claude_code' },
          allowedTools: params.options.allowedTools,
          maxTurns: params.options.maxTurns,
        },
      });
      for await (const message of iterable) {
        if (message.type === 'assistant') {
          const inner = message.message as { content?: Array<{ text?: string }> } | undefined;
          const text = (inner?.content ?? [])
            .map((b) => (typeof b.text === 'string' ? b.text : ''))
            .join('');
          yield { type: 'assistant', text };
        } else if (message.type === 'result') {
          const usage = message.usage as
            | { input_tokens: number; output_tokens: number }
            | undefined;
          yield { type: 'result', usage };
        }
      }
    };
  }

  async generateResponse(
    _question: SupervisorQuestion,
    context: SupervisorQuestionContext,
  ): Promise<SupervisorResponse> {
    const startTime = Date.now();
    const prompt = buildSupervisorPrompt(context);

    try {
      let responseText = '';
      let tokensUsed: number | undefined;

      for await (const message of this.queryFn({
        prompt,
        options: {
          allowedTools: [],
          maxTurns: 1,
        },
      })) {
        if (message.text) {
          responseText += message.text;
        }
        if (message.usage) {
          tokensUsed = message.usage.input_tokens + message.usage.output_tokens;
        }
      }

      const durationMs = Date.now() - startTime;
      const trimmedText = responseText.trim();

      if (trimmedText.startsWith(ESCALATE_PREFIX)) {
        const reason = trimmedText.slice(ESCALATE_PREFIX.length).trim();
        return {
          answer: '',
          escalated: true,
          escalationReason: reason,
          durationMs,
          tokensUsed,
        };
      }

      return {
        answer: trimmedText,
        escalated: false,
        durationMs,
        tokensUsed,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.message.includes('timed out')) {
          throw new SupervisorTimeoutError(durationMs);
        }
        if (error.name === 'RateLimitError' || error.message.includes('rate limit')) {
          throw new SupervisorRateLimitError(durationMs);
        }
      }

      throw error;
    }
  }
}
