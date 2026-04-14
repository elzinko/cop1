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
