/**
 * Verification gate (ADR-016): after a code-producing BMAD command completes,
 * the orchestrator must prove the produced code is sound (tests + lint pass)
 * BEFORE the story advances. A failing gate blocks the story instead of
 * silently flipping it to `in-review` / `done`.
 *
 * The port lives in the domain (pure contract); the shell-running
 * implementation (`CommandVerificationGate`) lives in infrastructure. The
 * command runner stays agnostic about HOW verification happens.
 */

export interface VerificationResult {
  /** True only if every configured check passed (exit 0). */
  readonly passed: boolean;
  /** Human-readable summary (which checks ran / which failed). */
  readonly summary: string;
}

export interface VerificationInput {
  /** Project root the checks run against. */
  readonly projectRoot: string;
  /** The BMAD command that just completed. */
  readonly command: string;
  /** Story being processed (for logging/correlation). */
  readonly storyKey: string;
}

/** Runs the project's verification checks for a completed command. */
export interface VerificationGate {
  verify(input: VerificationInput): Promise<VerificationResult>;
}

/**
 * Policy: which BMAD commands produce code that must be verified before the
 * story advances. Today only the development command; story-authoring and
 * review commands do not emit code. Substring match mirrors `BmadCycle`
 * command names.
 */
export function shouldVerify(command: string): boolean {
  return command.includes('dev-story');
}
