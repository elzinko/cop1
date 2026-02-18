export interface RuleProposalSubmission {
  type: 'architecture' | 'team' | 'agent' | 'quality' | 'process';
  ruleId: string;
  description: string;
  reason: string;
  submittedBy: string;
}

export interface RuleProposalRecord extends RuleProposalSubmission {
  status: 'pending' | 'approved' | 'rejected' | 'debated';
  submittedAt: string;
}
