import type { DoDCheck, DoDCheckResult, DoDContext } from '@cop1/sprint-core';
import { classifyReviewVerdict, isReviewCommand } from '../domain/ReviewVerdict.js';

/**
 * `DoDCheck` adapter (ADR-020) wrapping the review-verdict gate. Only a
 * `code-review` command whose output is an explicit `changes-requested`
 * verdict fails; everything else is satisfied — identical to the old inline
 * `if (isReviewCommand(command) && classifyReviewVerdict(joined) === ...)`.
 *
 * `detail` reproduces the historical blocking note verbatim (including the
 * 300-char output slice) so the runner's note stays byte-identical (golden
 * behaviour).
 */
export class ReviewVerdictDoDCheck implements DoDCheck {
  readonly id = 'review_verdict';

  async evaluate(ctx: DoDContext): Promise<DoDCheckResult> {
    if (!isReviewCommand(ctx.command)) return { satisfied: true };
    if (classifyReviewVerdict(ctx.agentOutput) !== 'changes-requested') return { satisfied: true };
    return {
      satisfied: false,
      detail: `code-review requested changes — not advancing to done: ${ctx.agentOutput.slice(0, 300)}`,
    };
  }
}
