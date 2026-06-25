/**
 * Per-story view over the run-level `BudgetGuard` (ADR-020). It does NOT credit
 * tokens of its own: it reads the run budget's monotonic counters and diffs them
 * from a snapshot taken at construction (= the start of the story).
 *
 * Trip semantics differ from `RunBudget`: a tripped `StoryBudget` blocks THIS
 * story (`nextStatus='blocked'`) and lets the run CONTINUE, whereas a tripped
 * `RunBudget` aborts the whole run.
 */

import type { BudgetGuard } from './RunBudget.js';

export type StoryBudgetReason = 'story-tokens' | 'story-wallclock';

export interface StoryBudgetConfig {
  maxTokens?: number;
  deadlineMs?: number;
}

export interface StoryBudgetStatus {
  tripped: boolean;
  reason?: StoryBudgetReason;
  storyTokens: number;
  storyElapsedMs: number;
}

export class StoryBudget {
  private readonly startTokens: number;
  private readonly startElapsed: number;

  constructor(
    private readonly source: BudgetGuard,
    private readonly config: StoryBudgetConfig,
  ) {
    const s = source.status();
    this.startTokens = s.spentTokens;
    this.startElapsed = s.elapsedMs;
  }

  status(): StoryBudgetStatus {
    const s = this.source.status();
    const storyTokens = s.spentTokens - this.startTokens;
    const storyElapsedMs = s.elapsedMs - this.startElapsed;

    // Priority order mirrors RunBudget: tokens > wallclock.
    if (this.config.maxTokens !== undefined && storyTokens >= this.config.maxTokens) {
      return { tripped: true, reason: 'story-tokens', storyTokens, storyElapsedMs };
    }
    if (this.config.deadlineMs !== undefined && storyElapsedMs >= this.config.deadlineMs) {
      return { tripped: true, reason: 'story-wallclock', storyTokens, storyElapsedMs };
    }
    return { tripped: false, storyTokens, storyElapsedMs };
  }
}
