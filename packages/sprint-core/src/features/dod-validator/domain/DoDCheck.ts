/**
 * DoDCheck — domain port for a single stateless Definition-of-Done criterion
 * (ADR-020). A check answers one question — "is THIS criterion satisfied for
 * the just-completed (story, command)?" — without driving the session itself.
 *
 * The runner's transition gates (verification ADR-016, review-verdict) become
 * `DoDCheck` adapters resolved by id through a `DoDCheckRegistry`. The seam is
 * declarative: adding a criterion is registry config, not a new if-block in the
 * runner (OCP).
 *
 * Out of scope here: the evidence gate, which DRIVES corrective "implement now"
 * continuations (stateful, session-driving) — folding it into a stateless check
 * is a tracked follow-up.
 */

/** Everything a check needs about the just-completed (story, command). */
export interface DoDContext {
  /** Project root the command ran against. */
  readonly projectRoot: string;
  /** The BMAD command that just completed. */
  readonly command: string;
  /** Story being processed (logging/correlation + check scoping). */
  readonly storyKey: string;
  /** Accumulated agent output across the session's turns. */
  readonly agentOutput: string;
}

/** Verdict of a single criterion. `detail` explains a non-satisfied result. */
export interface DoDCheckResult {
  readonly satisfied: boolean;
  readonly detail?: string;
}

/** A single Definition-of-Done criterion, addressable by a stable `id`. */
export interface DoDCheck {
  readonly id: string;
  evaluate(ctx: DoDContext): Promise<DoDCheckResult>;
}

/** Resolves a criterion id to its `DoDCheck`. The registry is the only path. */
export type DoDCheckRegistry = ReadonlyMap<string, DoDCheck>;
