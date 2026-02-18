export interface ArchitectureRuleProposal {
  type: 'architecture-rule';
  rule: string;
  reason: string;
  status: 'pending_review';
}

export interface RefactoringStoryProposal {
  type: 'refactoring-story';
  title: string;
  description: string;
  status: 'pending_review';
}

export type ImprovementProposal = ArchitectureRuleProposal | RefactoringStoryProposal;

export class RetroOutputMissingError extends Error {
  constructor(missing: string) {
    super(`Retrospective must produce at least 1 ${missing}`);
    this.name = 'RetroOutputMissingError';
  }
}
