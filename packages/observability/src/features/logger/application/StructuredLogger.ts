import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface LogEntry {
  timestamp: string;
  eventType: string;
  agentName?: string;
  storyId?: string;
  action?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export class StructuredLogger {
  private readonly logDir: string;

  constructor(projectPath: string) {
    this.logDir = join(projectPath, '.cop1');
  }

  event(type: string, payload: Record<string, unknown> = {}): void {
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        eventType: type,
        ...payload,
      };

      const filename = `sprint-log-${this.dateString()}.jsonl`;
      const filePath = join(this.logDir, filename);
      appendFileSync(filePath, `${JSON.stringify(entry)}\n`);
    } catch (error) {
      // Never throw — log to stderr and continue
      try {
        process.stderr.write(`[cop1-logger] Failed to write log: ${error}\n`);
      } catch {
        // Even stderr might fail — silently ignore
      }
    }
  }

  private dateString(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
