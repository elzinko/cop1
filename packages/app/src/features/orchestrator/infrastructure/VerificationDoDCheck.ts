import type { DoDCheck, DoDCheckResult, DoDContext } from '@cop1/sprint-core';
import { type VerificationGate, shouldVerify } from '../domain/VerificationGate.js';

/**
 * `DoDCheck` adapter (ADR-020) wrapping the ADR-016 verification gate. The gate
 * logic is unchanged — this only re-shapes it as a declarative criterion the
 * `DoDService` registry can resolve by id.
 *
 * Only meaningful for code-producing commands (`shouldVerify`). For other
 * commands the criterion is trivially satisfied (the gate never ran in the
 * original runner either), so the verdict is byte-identical to the old inline
 * `if (deps.verificationGate && shouldVerify(command))` guard.
 */
export class VerificationDoDCheck implements DoDCheck {
  readonly id = 'verification';

  constructor(private readonly gate: VerificationGate) {}

  async evaluate(ctx: DoDContext): Promise<DoDCheckResult> {
    if (!shouldVerify(ctx.command)) return { satisfied: true };
    const result = await this.gate.verify({
      projectRoot: ctx.projectRoot,
      command: ctx.command,
      storyKey: ctx.storyKey,
    });
    // `detail` carries the gate summary verbatim so the runner's blocking note
    // equals the historical `verification.summary` (golden behaviour).
    return { satisfied: result.passed, detail: result.summary };
  }
}
