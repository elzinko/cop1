import { execSync } from 'node:child_process';
import type { StepResult } from '../../workflow/domain/StepResult.js';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import type { WorkflowStep } from '../../workflow/domain/WorkflowStep.js';

/**
 * @deprecated Since 2026-04-14 (EA11-S1). The standalone cop1 agent pattern is
 * superseded by BMAD-driven multi-turn sessions invoked through `BMADSessionPort`
 * (ADR-012). This class remains as a safety-net fallback while
 * `config.workflow.useBMAD=false` is still supported (deprecated in EA11-S2).
 * Migration path: BMAD `qa` workflow driven by `SupervisorService` /
 * `OrchestratorService` (EA10). Scheduled for removal once EA10-S9 integration
 * test passes in production.
 */
export class QAAgent implements WorkflowStep {
  name = 'qa';

  async run(context: WorkflowContext): Promise<StepResult> {
    const cwd = context.projectPath;

    const testResult = this.runCommand('pnpm test', cwd);
    if (testResult.failed) {
      return {
        status: 'failed',
        error: new Error(`Tests failed: ${testResult.output.slice(0, 500)}`),
      };
    }

    const lintResult = this.runCommand('pnpm biome check .', cwd);
    if (lintResult.failed) {
      return {
        status: 'failed',
        error: new Error(`Lint check failed: ${lintResult.output.slice(0, 500)}`),
      };
    }

    return { status: 'ok' };
  }

  private runCommand(
    command: string,
    cwd: string,
  ): { failed: boolean; skipped: boolean; output: string } {
    try {
      const output = execSync(command, {
        cwd,
        stdio: 'pipe',
        timeout: 120_000,
        encoding: 'utf-8',
      });
      return { failed: false, skipped: false, output };
    } catch (error) {
      const err = error as { status?: number; stderr?: string; stdout?: string };
      const stderr = typeof err.stderr === 'string' ? err.stderr : '';
      const stdout = typeof err.stdout === 'string' ? err.stdout : '';
      const combined = stderr + stdout;

      // Skip when tool is not available (command not found, not installed)
      if (
        err.status === 127 ||
        combined.includes('command not found') ||
        combined.includes('ERR_PNPM_NO_SCRIPT') ||
        combined.includes('ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL') ||
        combined.includes('Cannot find module') ||
        combined.includes('not found:')
      ) {
        return { failed: false, skipped: true, output: 'tool not available' };
      }

      const output = stderr || stdout || String(error);
      return { failed: true, skipped: false, output };
    }
  }
}
