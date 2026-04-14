import type { EventBus } from '@cop1/shared-kernel';
import type { SessionHistoryFilter, SessionHistoryReader } from './SessionHistoryReader.js';
import type { SessionInteraction, SessionLogger } from './SessionLogger.js';

/**
 * Application-layer service that fronts session logging and history reading.
 *
 * Introduced by EA11-S3. Wraps the existing `SessionLogger` (write side) and
 * `SessionHistoryReader` (read side) behind a single, coherent API suitable for
 * exposure as MCP tools by the EA10 supervisor (ADR-014 §4.4 —
 * `query_session_history`).
 *
 * Keeps the existing `SessionInteraction` public type intact so no caller
 * migration is needed.
 */
export class HistoryService {
  constructor(
    private readonly logger: SessionLogger,
    private readonly reader: SessionHistoryReader,
    private readonly eventBus?: EventBus,
  ) {}

  recordExchange(interaction: SessionInteraction): void {
    this.logger.logInteraction(interaction);
    if (this.eventBus) {
      this.eventBus.emit('history.exchange.recorded', {
        sessionId: interaction.sessionId,
        storyId: interaction.storyId,
        turn: interaction.turn,
        role: interaction.role,
        ts: interaction.timestamp,
      });
    }
  }

  byStory(storyId: string): Promise<SessionInteraction[]> {
    return this.reader.getHistoryForStory(storyId);
  }

  byEpic(epicPrefix: string): Promise<SessionInteraction[]> {
    return this.reader.getHistoryForEpic(epicPrefix);
  }

  bySession(sessionId: string): Promise<SessionInteraction[]> {
    return this.query({ sessionId });
  }

  listRecent(limit = 50): Promise<SessionInteraction[]> {
    return this.reader.getRecentHistory(limit);
  }

  private query(filter: SessionHistoryFilter): Promise<SessionInteraction[]> {
    // SessionHistoryReader keeps `query` private; reuse the storyId/epicId entry
    // points when possible. For sessionId we fallback to listRecent + filter.
    if (filter.sessionId) {
      return this.reader
        .getRecentHistory(Number.MAX_SAFE_INTEGER)
        .then((rows) => rows.filter((r) => r.sessionId === filter.sessionId));
    }
    return Promise.resolve([]);
  }
}
