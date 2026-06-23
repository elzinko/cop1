/**
 * Evidence that a code-producing BMAD command actually changed the project.
 *
 * "Done" must be PROVEN by real source changes, never asserted by a session's
 * self-report. A `dev-story` session that merely prints an implementation plan
 * changes no files — yet reports `result:success`. Without this evidence check
 * the orchestrator advances the story (in-review → done) on fiction. See the
 * 2026-06-22 dogfood post-mortem.
 *
 * Port lives in the domain (pure contract); the git-backed implementation
 * (`GitWorkspaceInspector`) lives in infrastructure.
 */

/** Inspects the project's working tree for uncommitted changes. */
export interface WorkspaceInspectionPort {
  /** Paths changed in the working tree, relative to `projectRoot`. */
  changedPaths(projectRoot: string): Promise<string[]>;
}

/**
 * Orchestration bookkeeping paths that are NOT implementation evidence: BMAD
 * artefacts under `_bmad-output/` (story files and the status ledger) and cop1
 * run state under `.cop1/`. A change confined to these means "no code written".
 */
export function isBookkeepingPath(path: string): boolean {
  const p = path.replace(/^["']|["']$/g, '');
  return p.startsWith('_bmad-output/') || p.startsWith('.cop1/') || p.startsWith('.git/');
}

/** True iff at least one changed path is real implementation (non-bookkeeping). */
export function hasImplementationChanges(changedPaths: readonly string[]): boolean {
  return changedPaths.some((p) => p.length > 0 && !isBookkeepingPath(p));
}

/**
 * Policy: which BMAD commands MUST produce source changes to be considered done.
 * Today only the development command; story-authoring and review do not emit code.
 */
export function shouldHaveCodeChanges(command: string): boolean {
  return command.includes('dev-story');
}
