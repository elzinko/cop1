import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export interface AuthCheckResult {
  /** True when Claude is reachable and the probe completed successfully. */
  readonly ok: boolean;
  /** The active model (from the `system`/init message), or null if unknown. */
  readonly model: string | null;
  /** Error detail when `ok` is false. Never contains the API key. */
  readonly error?: string;
}

/** Injectable query function matching the SDK `query()` shape — overridden in tests. */
export type AuthQueryFn = (params: {
  prompt: string;
  options?: Options;
}) => AsyncIterable<SDKMessage>;

/**
 * Cheap connectivity probe: a single-turn, tool-less SDK call. Reports whether
 * Claude is reachable and the active model — read from the `system`/init message
 * (`SDKSystemMessage.model`), NOT the `result` message which carries no `model`
 * field. The API key / OAuth token is inherited from the environment and is never
 * surfaced in the result. Does its OWN dynamic import of the SDK (it does not
 * depend on the adapter's private loader).
 */
export async function checkAuth(queryFn?: AuthQueryFn): Promise<AuthCheckResult> {
  let model: string | null = null;
  try {
    const query =
      queryFn ?? ((await import('@anthropic-ai/claude-agent-sdk')).query as unknown as AuthQueryFn);
    const iterable = query({
      prompt: 'respond ok',
      options: {
        maxTurns: 1,
        allowedTools: [],
        systemPrompt: { type: 'preset', preset: 'claude_code' },
      },
    });
    for await (const message of iterable) {
      if (message.type === 'system' && message.subtype === 'init') {
        model = message.model;
      }
      if (message.type === 'result') {
        return message.subtype === 'success'
          ? { ok: true, model }
          : { ok: false, model, error: `auth check ended: ${message.subtype}` };
      }
    }
    return { ok: false, model, error: 'no result message from auth check' };
  } catch (err) {
    return { ok: false, model: null, error: err instanceof Error ? err.message : String(err) };
  }
}
