export interface RuleProposalSubmission {
  type: 'architecture' | 'team' | 'agent' | 'quality' | 'process';
  ruleId: string;
  description: string;
  reason: string;
  submittedBy: string;
}

export type RuleProposalStatus = 'pending' | 'approved' | 'rejected' | 'debated';

export const VALID_RULE_PROPOSAL_STATUSES: readonly RuleProposalStatus[] = [
  'pending',
  'approved',
  'rejected',
  'debated',
];

export interface RuleProposalRecord extends RuleProposalSubmission {
  status: RuleProposalStatus;
  submittedAt: string;
  rejectionReason?: string;
}
