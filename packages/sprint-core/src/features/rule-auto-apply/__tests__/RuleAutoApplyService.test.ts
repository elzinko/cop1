import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImprovementDecision } from '../../improvement-persistence/application/ImprovementPersistenceService.js';
import { RuleAutoApplyService } from '../application/RuleAutoApplyService.js';

describe('RuleAutoApplyService', () => {
  let eventBus: EventBus;
  let service: RuleAutoApplyService;

  const makeDecision = (overrides?: Partial<ImprovementDecision>): ImprovementDecision => ({
    id: 'DEC-001',
    type: 'architecture-rule',
    description: 'Enforce hexagonal architecture',
    status: 'approved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    eventBus = new EventBus();
    service = new RuleAutoApplyService(eventBus);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('should apply an approved rule decision', () => {
    const applyFn = vi.fn();
    const decision = makeDecision();

    const result = service.autoApply(decision, applyFn);

    expect(result).toBe(true);
    expect(applyFn).toHaveBeenCalledWith(
      'DEC-001',
      'Enforce hexagonal architecture',
      'architecture-rule',
    );
  });

  it('should skip non-approved decisions', () => {
    const applyFn = vi.fn();
    const decision = makeDecision({ status: 'pending_review' });

    const result = service.autoApply(decision, applyFn);

    expect(result).toBe(false);
    expect(applyFn).not.toHaveBeenCalled();
  });

  it('should skip non-rule types', () => {
    const applyFn = vi.fn();
    const decision = makeDecision({ type: 'agent-behavior' });

    const result = service.autoApply(decision, applyFn);

    expect(result).toBe(false);
    expect(applyFn).not.toHaveBeenCalled();
  });

  it('should emit rule.auto-applied event on apply', () => {
    const handler = vi.fn();
    eventBus.on('rule.auto-applied', handler);
    const applyFn = vi.fn();

    service.autoApply(makeDecision(), applyFn);

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0]?.[0] as { decisionId: string };
    expect(payload.decisionId).toBe('DEC-001');
  });
});
