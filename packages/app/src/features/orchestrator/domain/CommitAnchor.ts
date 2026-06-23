/**
 * Commit anchor (ADR-014 / EA14-S3): after a code-producing command is verified
 * done, the runner commits the work as a durable, rollback-able unit and records
 * the SHA in the Track 2 history.
 *
 * Why a runner-level port (not the BMAD agent): EA14-S3 added a `commit_anchor`
 * instruction to the supervisor prompt, but that prompt is consumed by the
 * supervisor LLM (`allowedTools: []`, `maxTurns: 1`), which cannot invoke any
 * tool — so the anchor never happened (Codex review). Doing the commit
 * deterministically in the runner is the simplest correct mechanism.
 *
 * Port lives in the domain (pure contract); the git-backed implementation
 * (`GitCommitAnchor`) lives in infrastructure.
 */
export interface CommitAnchorPort {
  /**
   * Stage all changes under `projectRoot` and commit them with `message`.
   * Returns the new commit SHA (short), or `null` when there was nothing to
   * commit or the commit failed (best-effort: never throws into the run loop).
   */
  commit(projectRoot: string, message: string): Promise<string | null>;
}

/** Deterministic anchor commit message for a (story, command) tuple. */
export function commitAnchorMessage(storyKey: string, command: string): string {
  return `chore(cop1): commit-anchor ${storyKey} after ${command}`;
}
