/**
 * Canonical BMAD command cycles used by cop1 runtime consumers.
 *
 * EA12-S3 (A5 pivot): these constants centralize BMAD command names so they
 * are no longer hardcoded in individual services (`PipelineStepFactory`) or
 * enumerated in the `supervisor-playbook.md`. The supervisor may substitute
 * any of these commands at runtime via `invoke_bmad_command`; the playbook
 * file is intended to express scrum intent, not command lists.
 */

/** Legacy SprintRunner BMAD pipeline (dev → review → QA). */
export const DEFAULT_BMAD_PIPELINE_COMMANDS = [
  '/bmad-bmm-dev-story',
  '/bmad-bmm-code-review',
  '/bmad-bmm-qa-automate',
] as const;

export type BmadPipelineCommand = (typeof DEFAULT_BMAD_PIPELINE_COMMANDS)[number];

export interface BmadCyclePhase {
  readonly name: string;
  readonly commands: readonly string[];
}

/**
 * Canonical orchestrator cycle (one phase → one or more BMAD commands).
 * Used by `OrchestratorService` as a fallback when a playbook phase does
 * not enumerate its own commands (A5 pivot — playbook is intent-only).
 */
export const DEFAULT_ORCHESTRATOR_CYCLE: readonly BmadCyclePhase[] = [
  { name: 'Story Creation', commands: ['/bmad-bmm-create-story'] },
  { name: 'Development Loop', commands: ['/bmad-bmm-dev-story', '/bmad-bmm-code-review'] },
];

const BY_NAME = new Map(DEFAULT_ORCHESTRATOR_CYCLE.map((p) => [p.name.toLowerCase(), p.commands]));

/**
 * Look up the canonical commands for a given phase name (case-insensitive).
 * Returns `undefined` if the phase name is not part of the default cycle.
 */
export function defaultCommandsForPhase(phaseName: string): readonly string[] | undefined {
  return BY_NAME.get(phaseName.toLowerCase());
}
