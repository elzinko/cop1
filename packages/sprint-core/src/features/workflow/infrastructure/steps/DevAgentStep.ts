import type { StepResult } from '../../domain/StepResult.js';
import type { WorkflowContext } from '../../domain/WorkflowContext.js';
import type { WorkflowStep } from '../../domain/WorkflowStep.js';

/**
 * @deprecated Since 2026-04-14 (EA11-S1). Legacy no-op stub used by the
 * `config.workflow.useBMAD=false` pipeline (deprecated in EA11-S2). Superseded by
 * BMAD `dev-story` workflow driven through `BMADSessionPort` (ADR-012) and the
 * EA10 `OrchestratorService`. Scheduled for removal once EA10-S9 integration
 * test passes in production.
 */
export class DevAgentStep implements WorkflowStep {
  name = 'dev';

  async run(_context: WorkflowContext): Promise<StepResult> {
    await new Promise((r) => setTimeout(r, 100));
    return { status: 'ok' };
  }
}
