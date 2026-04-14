import type { EventBus } from '@cop1/shared-kernel';
import type { StepResult } from '../../workflow/domain/StepResult.js';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import type { WorkflowStep } from '../../workflow/domain/WorkflowStep.js';
import { RetryPolicy } from '../domain/RetryPolicy.js';
import { BMADRetryExhaustedError } from '../domain/errors/BMADRetryExhaustedError.js';
import { BudgetExhaustedError } from '../domain/errors/BudgetExhaustedError.js';
import type {
  BMADSessionContext,
  BMADSessionPort,
  SessionHandle,
  SessionTurnResult,
} from '../domain/ports/BMADSessionPort.js';
import type { SupervisorContext } from '../domain/ports/SupervisorLLMPort.js';
import type { BudgetChecker } from './BMADCommandStep.js';
import type { SupervisorService } from './SupervisorService.js';

export interface BMADSessionStepOptions {
  /** Step name (e.g., 'bmad-dev', 'bmad-review', 'bmad-qa'). */
  name: string;
  /** BMAD slash command or workflow identifier (e.g., '/bmad-bmm-dev-story'). */
  command: string;
  /** Prefix used in failure error messages. */
  errorPrefix: string;
  retryPolicy?: RetryPolicy;
  budgetChecker?: BudgetChecker;
  /** EventBus for structured retry/session event emission. */
  eventBus?: EventBus;
  /** Custom delay function (injectable for testing). */
  delayFn?: (ms: number) => Promise<void>;
}

const defaultDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const MAX_FOLLOWUP_TURNS = 3;

/**
 * Multi-turn BMAD WorkflowStep (ADR-012). Drives a stateful BMAD session via
 * `BMADSessionPort` and routes intercepted questions through `SupervisorService`.
 *
 * IMPORTANT: The `BMADSessionPort` adapter (typically `AgentSdkSessionAdapter`)
 * MUST be constructed in the composition root with
 * `questionHandler = supervisorService.createQuestionHandler()`. This step does
 * NOT construct the adapter — it only consumes it.
 *
 * Mirrors `BMADCommandStep` retry/budget/event semantics. Retries operate at the
 * session level (a new `startSession()`) — never mid-session via `continueSession`.
 */
export class BMADSessionStep implements WorkflowStep {
  readonly name: string;
  private readonly command: string;
  private readonly errorPrefix: string;
  private readonly retryPolicy: RetryPolicy;
  private readonly budgetChecker?: BudgetChecker;
  private readonly eventBus?: EventBus;
  private readonly delayFn: (ms: number) => Promise<void>;

  constructor(
    private readonly sessionPort: BMADSessionPort,
    private readonly supervisorService: SupervisorService,
    options: BMADSessionStepOptions,
  ) {
    this.name = options.name;
    this.command = options.command;
    this.errorPrefix = options.errorPrefix;
    this.retryPolicy = options.retryPolicy ?? new RetryPolicy();
    this.budgetChecker = options.budgetChecker;
    this.eventBus = options.eventBus;
    this.delayFn = options.delayFn ?? defaultDelay;
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
      const finalOutput = await this.executeWithRetry(context);
      return { status: 'ok', report: finalOutput };
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

  /**
   * Retry wrapper around the entire session — mirrors
   * `BMADCommandStep.executeWithRetry()`. Each attempt starts a fresh session.
   */
  private async executeWithRetry(context: WorkflowContext): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryPolicy.maxRetries; attempt++) {
      // Budget check before each retry attempt (not before first)
      if (attempt > 0 && this.budgetChecker) {
        const budgetStatus = this.budgetChecker.getBudgetStatus();
        if (budgetStatus.remaining <= 0) {
          throw new BudgetExhaustedError(
            budgetStatus.consumed,
            budgetStatus.consumed + budgetStatus.remaining,
          );
        }
      }

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

      const attemptResult = await this.runSession(context);

      if (attemptResult.kind === 'success') {
        return attemptResult.output;
      }

      // Failure — decide retry vs. propagate
      const errorMessage = attemptResult.errorMessage;
      const isTransient = this.retryPolicy.isTransientError(errorMessage);

      if (!isTransient) {
        // Permanent — return failure to caller via thrown Error so outer try
        // wraps it consistently.
        throw new Error(`${this.errorPrefix}: ${errorMessage.slice(0, 500)}`);
      }

      lastError = new Error(errorMessage);

      if (attempt < this.retryPolicy.maxRetries) {
        this.eventBus?.emit('bmad.retry.transient', {
          step: this.name,
          attempt,
          error: errorMessage.slice(0, 200),
        });
      }
    }

    // All retries exhausted
    throw new BMADRetryExhaustedError(
      this.retryPolicy.maxRetries + 1,
      lastError ?? new Error(`${this.errorPrefix}: unknown error`),
    );
  }

  /**
   * Runs a single full session attempt (start + bounded follow-ups).
   * Returns `{ kind: 'success', output }` or `{ kind: 'failure', errorMessage }`.
   */
  private async runSession(
    context: WorkflowContext,
  ): Promise<{ kind: 'success'; output: string } | { kind: 'failure'; errorMessage: string }> {
    const storyContent = context.storyContent ?? '';
    const storyId = context.storyId;

    const supervisorContext: SupervisorContext = {
      workflowCommand: this.command,
      storyId,
      storyContent,
      // V1 stubs — enriched in a later story.
      projectContext: '',
      architectureRules: '',
      iamtheLawRules: '',
      sessionHistory: [],
      currentQuestion: '',
    };

    // Two-step wiring: (1) before startSession so that any question intercepted
    // during the very first turn already finds a wired QuestionHandler;
    // (2) again after startSession with the real sessionId for log correlation.
    this.supervisorService.setWorkflowContext(this.command, storyId, supervisorContext);

    const bmadSessionContext: BMADSessionContext = {
      projectPath: context.projectPath,
      storyId,
      metadata: { storyContent },
    };

    let handle: SessionHandle;
    try {
      handle = await this.sessionPort.startSession(this.command, bmadSessionContext);
    } catch (error) {
      // Adapter-thrown errors (network, SDK init) must flow through the retry
      // loop, not bypass it via the outer run() catch.
      return {
        kind: 'failure',
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    const outputs: string[] = [];
    let lastTurn: SessionTurnResult = handle.firstTurn;

    if (lastTurn.error === true) {
      return {
        kind: 'failure',
        errorMessage: lastTurn.errorMessage || lastTurn.output || 'unknown session error',
      };
    }

    // Re-wire with real sessionId only once the session is actually live.
    this.supervisorService.setWorkflowContext(
      this.command,
      storyId,
      supervisorContext,
      handle.sessionId,
    );

    if (lastTurn.output.length > 0) outputs.push(lastTurn.output);

    // Follow-up safety net: BMAD sessions should self-complete on the first
    // turn, but if not, nudge with 'C' up to MAX_FOLLOWUP_TURNS times.
    let followups = 0;
    while (!lastTurn.completed && followups < MAX_FOLLOWUP_TURNS) {
      followups++;
      try {
        lastTurn = await this.sessionPort.continueSession(handle.sessionId, 'C');
      } catch (error) {
        return {
          kind: 'failure',
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
      if (lastTurn.output.length > 0) outputs.push(lastTurn.output);
      if (lastTurn.error === true) {
        return {
          kind: 'failure',
          errorMessage: lastTurn.errorMessage || lastTurn.output || 'unknown session error',
        };
      }
    }

    if (!lastTurn.completed) {
      return {
        kind: 'failure',
        errorMessage: 'session did not complete within follow-up budget',
      };
    }

    const finalOutput = outputs.join('\n');
    if (finalOutput.length === 0) {
      return {
        kind: 'failure',
        errorMessage: 'session completed with empty output',
      };
    }
    return { kind: 'success', output: finalOutput };
  }
}
