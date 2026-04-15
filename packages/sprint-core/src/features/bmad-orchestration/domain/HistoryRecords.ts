import type { SessionInteraction } from '../application/SessionLogger.js';

export interface ExchangeFrontMatter {
  sessionId: string;
  storyId: string;
  sprintId: string;
  command: string;
  startedAt: string;
  endedAt: string;
  supervisorTurns: number;
  status: 'success' | 'failed' | 'escalated';
  /** EA12-S6 — SHA from commit_anchor when the workflow produced a commit. */
  commit?: string;
}

export interface ExchangeRecord {
  frontMatter: ExchangeFrontMatter;
  interactions: SessionInteraction[];
}

export interface MetricRecord {
  ts: string;
  sessionId: string;
  storyId: string;
  sprintId?: string;
  event: string;
  data?: Record<string, unknown>;
}
