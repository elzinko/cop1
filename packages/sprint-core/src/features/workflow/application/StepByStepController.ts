import type { StepByStepMode, StepByStepPort } from '../domain/ports/StepByStepPort.js';

export type ApprovalResolver = (context: {
  phase: 'intra' | 'inter';
  label?: string;
}) => Promise<'continue' | 'skip' | 'abort'>;

/**
 * Controls step-by-step pauses across intra-command (inside a BMAD session, EA8-S5)
 * and inter-command (between BMAD sessions, EA10-S5) phases.
 *
 * Introduced by EA11-S3. A single controller instance is shared by `SprintRunner`
 * (intra-phase) and `OrchestratorService` (inter-phase, when EA10-S5 lands).
 *
 * Default resolver auto-approves — production code wires a real resolver that
 * reads stdin or a `COP1_APPROVAL_FILE` per EA10-S5.
 */
export class StepByStepController implements StepByStepPort {
  private mode: StepByStepMode = 'none';
  private paused = false;

  constructor(private readonly resolver: ApprovalResolver = async () => 'continue') {}

  setMode(mode: StepByStepMode): void {
    this.mode = mode;
  }

  getMode(): StepByStepMode {
    return this.mode;
  }

  isPaused(): boolean {
    return this.paused;
  }

  async awaitApproval(context: {
    phase: 'intra' | 'inter';
    label?: string;
  }): Promise<'continue' | 'skip' | 'abort'> {
    if (!this.isPhaseActive(context.phase)) {
      return 'continue';
    }
    this.paused = true;
    try {
      return await this.resolver(context);
    } finally {
      this.paused = false;
    }
  }

  private isPhaseActive(phase: 'intra' | 'inter'): boolean {
    if (this.mode === 'none') return false;
    if (this.mode === 'both') return true;
    return this.mode === phase;
  }
}
