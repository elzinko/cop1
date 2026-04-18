import type { StructuredLogger } from '@cop1/observability';
import type { EventBus } from '@cop1/shared-kernel';
import type { MetricsWriter } from '../infrastructure/MetricsWriter.js';
import { SessionLogger, type SessionInteraction } from './SessionLogger.js';

/**
 * Decorates `SessionLogger` to collect `SessionInteraction` entries in memory
 * alongside the normal JSONL / EventBus / MetricsWriter write path.
 *
 * Call {@link drain} between sessions to retrieve (and clear) the collected
 * interactions for use by `ExchangeHistoryWriter` (Track 2 markdown).
 *
 * Introduced by EA14-S2 to bridge the gap between `SessionLogger` (writes to
 * JSONL) and `ExchangeHistoryWriter` (writes Track 2 per-session markdown).
 */
export class SessionInteractionCollector extends SessionLogger {
  private collected: SessionInteraction[] = [];

  constructor(
    logger: StructuredLogger,
    eventBus?: EventBus,
    metricsWriter?: MetricsWriter,
  ) {
    super(logger, eventBus, metricsWriter);
  }

  override logInteraction(entry: SessionInteraction): void {
    this.collected.push(entry);
    super.logInteraction(entry);
  }

  /**
   * Returns all interactions collected since the last drain (or construction)
   * and resets the internal buffer. The caller owns the returned array.
   */
  drain(): SessionInteraction[] {
    const result = this.collected;
    this.collected = [];
    return result;
  }
}
