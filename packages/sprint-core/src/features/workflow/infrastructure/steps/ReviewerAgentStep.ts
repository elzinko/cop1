import type { StepResult } from '../../domain/StepResult.js';
import type { WorkflowContext } from '../../domain/WorkflowContext.js';
import type { WorkflowStep } from '../../domain/WorkflowStep.js';

export class ReviewerAgentStep implements WorkflowStep {
  name = 'reviewer';

  async run(_context: WorkflowContext): Promise<StepResult> {
    await new Promise((r) => setTimeout(r, 100));
    return { status: 'ok' };
  }
}
