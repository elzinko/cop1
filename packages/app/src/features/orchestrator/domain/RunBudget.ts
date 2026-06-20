/**
 * Pure run-budget domain. Zero IO: the wall-clock source and the external abort
 * predicate are injected so the guard stays deterministic and testable.
 *
 * Used by the orchestrator to stop an unattended run cleanly when (a) cumulative
 * tokens exceed a cap, (b) a wall-clock deadline is exceeded, or (c) an external
 * abort signal (e.g. a `.cop1/abort` file) appears.
 */

export type BudgetReason = 'tokens' | 'wallclock' | 'abort-file';

export interface BudgetStatus {
  tripped: boolean;
  reason?: BudgetReason;
  spentTokens: number;
  elapsedMs: number;
}

export interface BudgetGuard {
  recordTokens(n: number): void;
  status(): BudgetStatus;
}

export interface RunBudgetConfig {
  maxTokens?: number;
  deadlineMs?: number;
  now?: () => number;
  externalAbort?: () => boolean;
}

export class RunBudget implements BudgetGuard {
  private readonly maxTokens?: number;
  private readonly deadlineMs?: number;
  private readonly now: () => number;
  private readonly externalAbort: () => boolean;
  private readonly startTime: number;
  private spentTokens = 0;

  constructor(config: RunBudgetConfig = {}) {
    this.maxTokens = config.maxTokens;
    this.deadlineMs = config.deadlineMs;
    this.now = config.now ?? Date.now;
    this.externalAbort = config.externalAbort ?? (() => false);
    this.startTime = this.now();
  }

  recordTokens(n: number): void {
    this.spentTokens += n;
  }

  status(): BudgetStatus {
    const elapsedMs = this.now() - this.startTime;

    // Priority order: tokens > wallclock > abort-file.
    if (this.maxTokens !== undefined && this.spentTokens >= this.maxTokens) {
      return { tripped: true, reason: 'tokens', spentTokens: this.spentTokens, elapsedMs };
    }
    if (this.deadlineMs !== undefined && elapsedMs >= this.deadlineMs) {
      return { tripped: true, reason: 'wallclock', spentTokens: this.spentTokens, elapsedMs };
    }
    if (this.externalAbort() === true) {
      return { tripped: true, reason: 'abort-file', spentTokens: this.spentTokens, elapsedMs };
    }
    return { tripped: false, spentTokens: this.spentTokens, elapsedMs };
  }
}
