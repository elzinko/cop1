export interface PlaybookCommand {
  command: string;
  note?: string;
}

export interface PlaybookPhase {
  name: string;
  commands: PlaybookCommand[];
}

export interface EpicRestrictions {
  raw: string;
}

export interface PlaybookBudgets {
  /** Per-night cumulative token cap. Added EA12-S5 (A1). */
  max_tokens_per_night?: number;
  /** Max supervisor re-entrance depth for invoke_bmad_command. Added EA12-S5 (A4). */
  max_reentrance_depth?: number;
}

export interface SupervisorPlaybook {
  version: string;
  helpRef: string;
  phases: PlaybookPhase[];
  epicRestrictions?: EpicRestrictions;
  hooks: {
    worktree?: string;
    stepByStep?: string;
  };
  decisionPolicy?: string;
  budgets?: PlaybookBudgets;
}

export class PlaybookValidationError extends Error {
  constructor(
    message: string,
    readonly offendingCommand?: string,
    readonly line?: number,
  ) {
    super(message);
    this.name = 'PlaybookValidationError';
  }
}
