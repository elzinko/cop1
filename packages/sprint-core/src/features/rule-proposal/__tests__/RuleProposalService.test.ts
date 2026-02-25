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

  it('should emit rule.applied event when status updated to approved', () => {
    const handler = vi.fn();
    eventBus.on('rule.applied', handler);

    service.submit(validSubmission);
    service.updateStatus('RULE-001', 'approved');

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0]?.[0] as { ruleId: string; status: string };
    expect(payload.ruleId).toBe('RULE-001');
    expect(payload.status).toBe('approved');
  });

  it('should emit rule.rejected event when status updated to rejected', () => {
    const handler = vi.fn();
    eventBus.on('rule.rejected', handler);

    service.submit(validSubmission);
    service.updateStatus('RULE-001', 'rejected');

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0]?.[0] as { ruleId: string; status: string };
    expect(payload.ruleId).toBe('RULE-001');
    expect(payload.status).toBe('rejected');
  });

  it('should emit rule.proposal.debated event when status updated to debated', () => {
    const handler = vi.fn();
    eventBus.on('rule.proposal.debated', handler);

    service.submit(validSubmission);
    service.updateStatus('RULE-001', 'debated');

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0]?.[0] as { ruleId: string; status: string };
    expect(payload.ruleId).toBe('RULE-001');
    expect(payload.status).toBe('debated');
  });

  it('should store rejection reason when provided', () => {
    service.submit(validSubmission);

    const updated = service.updateStatus('RULE-001', 'rejected', 'Not aligned with goals');
    expect(updated.status).toBe('rejected');
    expect(updated.rejectionReason).toBe('Not aligned with goals');

    const fetched = service.getById('RULE-001');
    expect(fetched?.rejectionReason).toBe('Not aligned with goals');
  });

  it('should not overwrite rejection reason when not provided', () => {
    service.submit(validSubmission);

    service.updateStatus('RULE-001', 'rejected', 'Initial reason');
    const updated = service.updateStatus('RULE-001', 'debated');
    expect(updated.rejectionReason).toBe('Initial reason');
  });
});
