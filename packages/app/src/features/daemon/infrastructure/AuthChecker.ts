import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { type ClaudeAvailability, RetryPolicy } from '@cop1/sprint-core';

export interface AuthCheckResult {
  /** True when Claude is reachable and the probe completed successfully. */
  readonly ok: boolean;
  /** The active model (from the `system`/init message), or null if unknown. */
  readonly model: string | null;
  /** Error detail when `ok` is false. Never contains the API key. */
  readonly error?: string;
  /**
   * Coarse Claude availability for the traffic-light panel:
   * - `ok`          — probe succeeded.
   * - `degraded`    — probe failed with a *transient* blockage (overloaded /
   *   rate-limit / 5xx / network): Claude is up but momentarily unreachable.
   * - `unavailable` — probe failed for a hard reason (auth, invalid request).
   */
  readonly availability: ClaudeAvailability;
}

/** Injectable query function matching the SDK `query()` shape — overridden in tests. */
export type AuthQueryFn = (params: {
  prompt: string;
  options?: Options;
}) => AsyncIterable<SDKMessage>;

/** Shared transient classifier (overloaded / 429 / 5xx / network → degraded). */
const transientClassifier = new RetryPolicy();

/** Maps a probe outcome to a coarse availability for the panel. */
function availabilityFor(ok: boolean, error?: string): ClaudeAvailability {
  if (ok) return 'ok';
  return error && transientClassifier.isTransientError(error) ? 'degraded' : 'unavailable';
}

/**
 * Cheap connectivity probe: a single-turn, tool-less SDK call. Reports whether
 * Claude is reachable, the active model — read from the `system`/init message
 * (`SDKSystemMessage.model`), NOT the `result` message which carries no `model`
 * field — and a coarse `availability` (a transient blockage shows as `degraded`,
 * not a hard `unavailable`). The API key / OAuth token is inherited from the
 * environment and is never surfaced in the result. Does its OWN dynamic import of
 * the SDK (it does not depend on the adapter's private loader).
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
        // Make the probe genuinely tool-less (Codex review): `allowedTools: []`
        // only auto-approves nothing — unlisted tools still fall through to
        // settings/permissionMode. Load NO filesystem settings so project/user
        // MCP servers + hooks never start, and deny any tool defensively. A
        // credential check must not execute side effects.
        settingSources: [],
        canUseTool: async (toolName: string) => ({
          behavior: 'deny' as const,
          message: `auth probe is tool-less (blocked ${toolName})`,
        }),
      },
    });
    for await (const message of iterable) {
      if (message.type === 'system' && message.subtype === 'init') {
        model = message.model;
      }
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          return { ok: true, model, availability: 'ok' };
        }
        const error = `auth check ended: ${message.subtype}`;
        return { ok: false, model, error, availability: availabilityFor(false, error) };
      }
    }
    const error = 'no result message from auth check';
    return { ok: false, model, error, availability: availabilityFor(false, error) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, model: null, error, availability: availabilityFor(false, error) };
  }
}
