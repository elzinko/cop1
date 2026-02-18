import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuleProposalService } from '../application/RuleProposalService.js';
import type { RuleProposalSubmission } from '../domain/RuleProposalTypes.js';

describe('RuleProposalService', () => {
  let eventBus: EventBus;
  let service: RuleProposalService;

  const validSubmission: RuleProposalSubmission = {
    type: 'architecture',
    ruleId: 'RULE-001',
    description: 'Enforce hexagonal architecture',
    reason: 'Maintain clean boundaries',
    submittedBy: 'dev-agent',
  };

  beforeEach(() => {
    eventBus = new EventBus();
    service = new RuleProposalService(eventBus);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('should submit a rule proposal with pending status', () => {
    const record = service.submit(validSubmission);

    expect(record.ruleId).toBe('RULE-001');
    expect(record.status).toBe('pending');
    expect(record.submittedAt).toBeDefined();
    expect(record.description).toBe('Enforce hexagonal architecture');
  });

  it('should list all submitted proposals', () => {
    service.submit(validSubmission);
    service.submit({ ...validSubmission, ruleId: 'RULE-002', description: 'Another rule' });

    const all = service.getAll();
    expect(all).toHaveLength(2);
  });

  it('should get a proposal by id', () => {
    service.submit(validSubmission);

    const found = service.getById('RULE-001');
    expect(found).toBeDefined();
    expect(found?.description).toBe('Enforce hexagonal architecture');

    const notFound = service.getById('RULE-999');
    expect(notFound).toBeUndefined();
  });

  it('should update the status of a proposal', () => {
    service.submit(validSubmission);

    const updated = service.updateStatus('RULE-001', 'approved');
    expect(updated.status).toBe('approved');

    const fetched = service.getById('RULE-001');
    expect(fetched?.status).toBe('approved');
  });

  it('should emit rule.proposal.submitted event on submit', () => {
    const handler = vi.fn();
    eventBus.on('rule.proposal.submitted', handler);

    service.submit(validSubmission);

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0]?.[0] as { ruleId: string };
    expect(payload.ruleId).toBe('RULE-001');
  });
});
