import type { StepResult } from '../../workflow/domain/StepResult.js';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import type { WorkflowStep } from '../../workflow/domain/WorkflowStep.js';
import { MaxRejectionsError, type ReviewResult } from '../domain/ReviewResult.js';
import type { ReviewerPort } from '../domain/ports/ReviewerPort.js';

/**
 * @deprecated Since 2026-04-14 (EA11-S1). The standalone cop1 agent pattern is
 * superseded by BMAD-driven multi-turn sessions invoked through `BMADSessionPort`
 * (ADR-012). This class remains as a safety-net fallback while
 * `config.workflow.useBMAD=false` is still supported (deprecated in EA11-S2).
 * Migration path: BMAD `code-review` workflow driven by `SupervisorService` /
 * `OrchestratorService` (EA10). Scheduled for removal once EA10-S9 integration
 * test passes in production.
 */
export class ReviewerAgent implements WorkflowStep {
  name = 'reviewer';

  private rejectionCounts = new Map<string, number>();

  constructor(
    private readonly reviewer: ReviewerPort,
    private readonly maxRejections: number = 3,
  ) {}

  async run(context: WorkflowContext): Promise<StepResult> {
    try {
      const result = await this.reviewer.review(`Quality report for ${context.storyId}`);

      if (result.verdict === 'request-changes') {
        const count = (this.rejectionCounts.get(context.storyId) ?? 0) + 1;
        this.rejectionCounts.set(context.storyId, count);

        if (count >= this.maxRejections) {
          throw new MaxRejectionsError(context.storyId, count);
        }

        return {
          status: 'failed',
          error: new Error(
            `Review rejected (${count}/${this.maxRejections}): ${result.comments.join(', ')}`,
          ),
        };
      }

      this.rejectionCounts.delete(context.storyId);
      return { status: 'ok' };
    } catch (error) {
      if (error instanceof MaxRejectionsError) {
        return { status: 'blocked', error };
      }
      return {
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  getReviewResult(): ReviewResult {
    return { verdict: 'approve', comments: [] };
  }
}
