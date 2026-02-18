import type { EventBus } from '@cop1/shared-kernel';
import type { RuleProposalRecord, RuleProposalSubmission } from '../domain/RuleProposalTypes.js';

export class RuleProposalService {
  private readonly proposals = new Map<string, RuleProposalRecord>();

  constructor(private readonly eventBus: EventBus) {}

  submit(submission: RuleProposalSubmission): RuleProposalRecord {
    if (
      !submission.ruleId ||
      !submission.description ||
      !submission.reason ||
      !submission.submittedBy
    ) {
      throw new Error('Invalid submission: all fields are required');
    }

    const record: RuleProposalRecord = {
      ...submission,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };

    this.proposals.set(record.ruleId, record);
    this.eventBus.emit('rule.proposal.submitted', record);

    return record;
  }

  getAll(): RuleProposalRecord[] {
    return [...this.proposals.values()];
  }

  getById(ruleId: string): RuleProposalRecord | undefined {
    return this.proposals.get(ruleId);
  }

  updateStatus(ruleId: string, status: RuleProposalRecord['status']): RuleProposalRecord {
    const record = this.proposals.get(ruleId);
    if (!record) {
      throw new Error(`Rule proposal not found: ${ruleId}`);
    }

    record.status = status;
    this.proposals.set(ruleId, record);

    return record;
  }
}
