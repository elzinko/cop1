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
  /**
   * The agent's accumulated session output (or failure note). Captured so a
   * NON-interactive session — one that never triggered `AskUserQuestion`, hence
   * has zero supervisor interactions — still produces a meaningful Track 2
   * record instead of "_No interactions recorded._".
   */
  agentOutput?: string;
}

export interface MetricRecord {
  ts: string;
  sessionId: string;
  storyId: string;
  sprintId?: string;
  event: string;
  data?: Record<string, unknown>;
}
