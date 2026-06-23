/**
 * Claude availability as observed from inside a running BMAD session.
 *
 * Emitted on the `EventBus` as `claude.status` so the orchestrator log — and,
 * later, the web traffic-light panel — can surface a temporary Claude blockage
 * (overloaded / rate-limited / network) instead of silently retrying or failing.
 *
 * - `ok`          — a session turn completed normally (after a prior retry: "recovered").
 * - `degraded`    — a transient error occurred and the session is retrying with backoff.
 * - `unavailable` — transient retries were exhausted; Claude is effectively unreachable.
 */
export type ClaudeAvailability = 'ok' | 'degraded' | 'unavailable';

/** EventBus topic carrying {@link ClaudeStatusEvent}. */
export const CLAUDE_STATUS_EVENT = 'claude.status';

export interface ClaudeStatusEvent {
  readonly status: ClaudeAvailability;
  /** 1-indexed retry attempt that produced this status (0 for a first-try success). */
  readonly attempt: number;
  /** Short error detail for `degraded`/`unavailable`; never includes credentials. */
  readonly detail?: string;
  /** Correlating session id, when known. */
  readonly sessionId?: string;
  readonly storyId?: string;
  readonly timestamp: string;
}
