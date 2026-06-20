import type { EventBus } from '@cop1/shared-kernel';
import type { BudgetStatus } from '../../budget/domain/BudgetStatus.js';
import type { StepResult } from '../../workflow/domain/StepResult.js';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import type { WorkflowStep } from '../../workflow/domain/WorkflowStep.js';
import { RetryPolicy } from '../domain/RetryPolicy.js';
import { StoryContextBuilder } from '../domain/StoryContextBuilder.js';
import { BMADRetryExhaustedError } from '../domain/errors/BMADRetryExhaustedError.js';
import { BudgetExhaustedError } from '../domain/errors/BudgetExhaustedError.js';
import type { BMADCommandPort, BMADCommandResult } from '../domain/ports/BMADCommandPort.js';

/** Optional budget checker port — allows checking budget before commands. */
export interface BudgetChecker {
  getBudgetStatus(): BudgetStatus;
}

export interface BMADCommandStepOptions {
  retryPolicy?: RetryPolicy;
  budgetChecker?: BudgetChecker;
  /** EventBus for structured retry event emission. */
  eventBus?: EventBus;
  /** Custom delay function (injectable for testing). */
  delayFn?: (ms: number) => Promise<void>;
}

const defaultDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export abstract class BMADCommandStep implements WorkflowStep {
  abstract readonly name: string;
  protected abstract readonly command: string;
  protected abstract readonly errorPrefix: string;

  private readonly contextBuilder = new StoryContextBuilder();
  private readonly retryPolicy: RetryPolicy;
  private readonly budgetChecker?: BudgetChecker;
  private readonly eventBus?: EventBus;
  private readonly delayFn: (ms: number) => Promise<void>;

  constructor(
    protected readonly commandPort: BMADCommandPort,
    options?: BMADCommandStepOptions,
  ) {
    this.retryPolicy = options?.retryPolicy ?? new RetryPolicy();
    this.budgetChecker = options?.budgetChecker;
    this.eventBus = options?.eventBus;
    this.delayFn = options?.delayFn ?? defaultDelay;
  }

  async run(context: WorkflowContext): Promise<StepResult> {
    // Pre-flight budget check
    if (this.budgetChecker) {
      const budgetStatus = this.budgetChecker.getBudgetStatus();
      if (budgetStatus.remaining <= 0) {
        return {
          status: 'blocked',
          error: new BudgetExhaustedError(
            budgetStatus.consumed,
            budgetStatus.consumed + budgetStatus.remaining,
          ),
        };
      }
    }

    try {
      const storyContent = context.storyContent ?? `Story: ${context.storyId}`;

      const bmadContext = this.contextBuilder.build({
        storyId: context.storyId,
        storyContent,
        projectPath: context.projectPath,
      });

      const result = await this.executeWithRetry(bmadContext);

      if (!result.success) {
        return {
          status: 'failed',
          error: new Error(`${this.errorPrefix}: ${result.output.slice(0, 500)}`),
        };
      }

      return {
        status: 'ok',
        report: result.output,
      };
    } catch (error) {
      if (error instanceof BudgetExhaustedError) {
        return { status: 'blocked', error };
      }
      return {
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private async executeWithRetry(bmadContext: Record<string, string>): Promise<BMADCommandResult> {
    let lastResult: BMADCommandResult | undefined;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryPolicy.maxRetries; attempt++) {
      // Budget check before each retry attempt
      if (attempt > 0 && this.budgetChecker) {
        const budgetStatus = this.budgetChecker.getBudgetStatus();
        if (budgetStatus.remaining <= 0) {
          throw new BudgetExhaustedError(
            budgetStatus.consumed,
            budgetStatus.consumed + budgetStatus.remaining,
          );
        }
      }

      // Wait before retry (not before first attempt)
      if (attempt > 0) {
        const delayMs = this.retryPolicy.getDelayMs(attempt - 1);
        this.eventBus?.emit('bmad.retry.attempt', {
          step: this.name,
          attempt,
          maxRetries: this.retryPolicy.maxRetries,
          delayMs,
        });
        await this.delayFn(delayMs);
      }

      lastResult = await this.commandPort.execute(this.command, bmadContext);

      if (lastResult.success) {
        return lastResult;
      }

      // Check if this is a transient error worth retrying
      // Prefer adapter-provided classification, fallback to string matching
      const isTransient =
        lastResult.retryable ?? this.retryPolicy.isTransientError(lastResult.output);
      if (!isTransient) {
        return lastResult; // Permanent error — don't retry
      }

      lastError = new Error(lastResult.output);

      if (attempt < this.retryPolicy.maxRetries) {
        this.eventBus?.emit('bmad.retry.transient', {
          step: this.name,
          attempt,
          error: lastResult.output.slice(0, 200),
        });
      }
    }

    // All retries exhausted
    if (lastError) {
      throw new BMADRetryExhaustedError(this.retryPolicy.maxRetries + 1, lastError);
    }

    if (lastResult === undefined) {
      throw new Error('BMADCommandStep: retry loop produced no result');
    }
    return lastResult;
  }
}
