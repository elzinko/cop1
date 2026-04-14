import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SessionInteraction } from './SessionLogger.js';

export interface SessionHistoryFilter {
  storyId?: string;
  epicId?: string;
  sessionId?: string;
  from?: Date;
  to?: Date;
}

/**
 * Reads session interactions from .cop1/sprint-log-*.jsonl files.
 * Filters and returns SessionInteraction[] sorted chronologically.
 */
export class SessionHistoryReader {
  private readonly logDir: string;

  constructor(projectPath: string) {
    this.logDir = join(projectPath, '.cop1');
  }

  async getHistoryForStory(storyId: string): Promise<SessionInteraction[]> {
    return this.query({ storyId });
  }

  async getHistoryForEpic(epicPrefix: string): Promise<SessionInteraction[]> {
    return this.query({ epicId: epicPrefix });
  }

  async getRecentHistory(limit = 50): Promise<SessionInteraction[]> {
    // Read files newest-first and stop as soon as we have `limit` entries,
    // so long-running projects don't pay O(total_log_size) on every call.
    let files: string[];
    try {
      const allFiles = await readdir(this.logDir);
      files = allFiles
        .filter((f) => f.startsWith('sprint-log-') && f.endsWith('.jsonl'))
        .sort()
        .reverse();
    } catch {
      return [];
    }

    const collected: SessionInteraction[] = [];
    for (const file of files) {
      if (collected.length >= limit) break;
      const filePath = join(this.logDir, file);
      let content: string;
      try {
        content = await readFile(filePath, 'utf-8');
      } catch {
        continue;
      }
      const lines = content.split('\n').filter(Boolean);
      // Walk lines in reverse so newest-in-file come first.
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;
        try {
          const raw = JSON.parse(line) as Record<string, unknown>;
          const eventType = raw.eventType as string | undefined;
          if (!eventType?.startsWith('session.turn.') || !raw.storyId) continue;
          collected.push(this.parseEntry(raw, eventType));
          if (collected.length >= limit) break;
        } catch {
          // Skip malformed lines
        }
      }
    }
    // Return chronologically for API consistency.
    collected.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return collected;
  }

  private async query(filter: SessionHistoryFilter): Promise<SessionInteraction[]> {
    const entries: SessionInteraction[] = [];

    let files: string[];
    try {
      const allFiles = await readdir(this.logDir);
      files = allFiles.filter((f) => f.startsWith('sprint-log-') && f.endsWith('.jsonl'));
    } catch {
      return [];
    }

    files.sort();

    for (const file of files) {
      const filePath = join(this.logDir, file);
      let content: string;
      try {
        content = await readFile(filePath, 'utf-8');
      } catch {
        continue;
      }

      const lines = content.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const raw = JSON.parse(line) as Record<string, unknown>;
          const eventType = raw.eventType as string | undefined;
          if (!eventType?.startsWith('session.turn.')) {
            continue;
          }
          if (!raw.storyId) {
            continue;
          }

          const interaction = this.parseEntry(raw, eventType);
          if (this.matches(interaction, filter)) {
            entries.push(interaction);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return entries;
  }

  private parseEntry(raw: Record<string, unknown>, eventType: string): SessionInteraction {
    return {
      timestamp: (raw.timestamp as string) ?? new Date().toISOString(),
      sessionId: (raw.sessionId as string) ?? '',
      storyId: (raw.storyId as string) ?? '',
      epicId: (raw.epicId as string) ?? '',
      workflowCommand: (raw.workflowCommand as string) ?? '',
      turn: (raw.turn as number) ?? 0,
      role: (raw.role as SessionInteraction['role']) ?? 'system',
      content: (raw.content as string) ?? '',
      analysis: {
        type: (raw.analysisType as SessionInteraction['analysis']['type']) ?? 'question_simple',
        method: this.methodFromEventType(eventType, raw),
      },
      durationMs: (raw.durationMs as number) ?? 0,
      tokensUsed: raw.tokensUsed as number | undefined,
    };
  }

  private methodFromEventType(
    eventType: string,
    raw: Record<string, unknown>,
  ): SessionInteraction['analysis']['method'] {
    if (raw.analysisMethod) {
      return raw.analysisMethod as SessionInteraction['analysis']['method'];
    }
    if (eventType === 'session.turn.answered_deterministic') return 'deterministic';
    if (eventType === 'session.turn.answered_llm') return 'llm';
    if (eventType === 'session.turn.escalated') return 'escalation';
    return 'deterministic';
  }

  private matches(entry: SessionInteraction, filter: SessionHistoryFilter): boolean {
    if (filter.storyId && entry.storyId !== filter.storyId) return false;
    if (filter.epicId && !entry.epicId.startsWith(filter.epicId)) return false;
    if (filter.sessionId && entry.sessionId !== filter.sessionId) return false;
    if (filter.from && entry.timestamp < filter.from.toISOString()) return false;
    if (filter.to && entry.timestamp > filter.to.toISOString()) return false;
    return true;
  }
}
