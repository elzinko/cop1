import type { StructuredLogger } from '@cop1/observability';
import type { EventBus } from '@cop1/shared-kernel';

export interface SessionInteraction {
  timestamp: string;
  sessionId: string;
  storyId: string;
  epicId: string;
  workflowCommand: string;
  turn: number;
  role: 'workflow' | 'supervisor' | 'system';
  content: string;
  analysis: {
    type: 'question_simple' | 'question_complex' | 'completion' | 'error' | 'escalation';
    method: 'deterministic' | 'llm' | 'escalation';
  };
  durationMs: number;
  tokensUsed?: number;
}

/**
 * Derives epicId from storyId by extracting everything before the last `-S`.
 * Examples: "EA9-S3" -> "EA9", "E12-S6b" -> "E12", "EA2-S0c" -> "EA2"
 */
export function deriveEpicId(storyId: string): string {
  const lastSIndex = storyId.lastIndexOf('-S');
  if (lastSIndex === -1) {
    return storyId;
  }
  return storyId.slice(0, lastSIndex);
}

/**
 * Logs supervisor session interactions to StructuredLogger (JSONL)
 * and emits real-time events via EventBus.
 */
export class SessionLogger {
  constructor(
    private readonly logger: StructuredLogger,
    private readonly eventBus?: EventBus,
  ) {}

  logInteraction(entry: SessionInteraction): void {
    const eventType = this.resolveEventType(entry);

    this.logger.event(eventType, {
      sessionId: entry.sessionId,
      storyId: entry.storyId,
      epicId: entry.epicId,
      workflowCommand: entry.workflowCommand,
      turn: entry.turn,
      role: entry.role,
      content: entry.content,
      analysisType: entry.analysis.type,
      analysisMethod: entry.analysis.method,
      durationMs: entry.durationMs,
      tokensUsed: entry.tokensUsed,
    });

    if (this.eventBus) {
      this.eventBus.emit(eventType, {
        sessionId: entry.sessionId,
        storyId: entry.storyId,
        epicId: entry.epicId,
        turn: entry.turn,
        role: entry.role,
        content: entry.content,
        method: entry.analysis.method,
        durationMs: entry.durationMs,
      });
    }
  }

  private resolveEventType(entry: SessionInteraction): string {
    if (entry.role === 'workflow') {
      return 'session.turn.question_intercepted';
    }
    switch (entry.analysis.method) {
      case 'deterministic':
        return 'session.turn.answered_deterministic';
      case 'llm':
        return 'session.turn.answered_llm';
      case 'escalation':
        return 'session.turn.escalated';
    }
  }
}
