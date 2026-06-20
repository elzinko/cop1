import { spawn } from 'node:child_process';
import type {
  VerificationGate,
  VerificationInput,
  VerificationResult,
} from '../domain/VerificationGate.js';

/** Injectable command executor — resolves the process exit code. */
export type CheckExecutor = (command: string, cwd: string) => Promise<number>;

export interface CommandVerificationGateOptions {
  /** Shell checks to run, in order. Default: project tests then lint. */
  readonly checks?: readonly string[];
  /** Injectable executor (default spawns a shell). Override in tests. */
  readonly executor?: CheckExecutor;
}

/** Default checks for a pnpm/TypeScript project. */
export const DEFAULT_CHECKS = ['pnpm -s test', 'pnpm -s lint'] as const;

/** Default executor: run `command` in `cwd` via the shell, resolve its exit code. */
const shellExecutor: CheckExecutor = (command, cwd) =>
  new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, stdio: 'ignore' });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });

/**
 * Runs a list of shell checks (tests, lint) in the project root and passes only
 * if all exit 0. Fail-fast: stops at the first failing check (no point linting
 * code whose tests already fail — and it saves time/tokens on overnight runs).
 *
 * Both the check list and the executor are injectable for testability — no real
 * shell runs in unit tests.
 */
export class CommandVerificationGate implements VerificationGate {
  private readonly checks: readonly string[];
  private readonly executor: CheckExecutor;

  constructor(options: CommandVerificationGateOptions = {}) {
    this.checks = options.checks ?? DEFAULT_CHECKS;
    this.executor = options.executor ?? shellExecutor;
  }

  async verify(input: VerificationInput): Promise<VerificationResult> {
    for (const check of this.checks) {
      const exitCode = await this.executor(check, input.projectRoot);
      if (exitCode !== 0) {
        return { passed: false, summary: `verify failed: ${check} (exit ${exitCode})` };
      }
    }
    return { passed: true, summary: `verify ok: ${this.checks.join(', ')}` };
  }
}
