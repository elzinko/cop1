import { EventBus } from '@cop1/shared-kernel';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeveloperReviewService } from '../application/DeveloperReviewService.js';

describe('DeveloperReviewService', () => {
  let eventBus: EventBus;
  let service: DeveloperReviewService;

  beforeEach(() => {
    eventBus = new EventBus();
    service = new DeveloperReviewService(eventBus);
  });

  it('should approve and emit improvement.approved event', () => {
    const handler = vi.fn();
    eventBus.on('improvement.approved', handler);

    const result = service.approve('SUG-001');

    expect(result.action).toBe('approved');
    expect(result.suggestionId).toBe('SUG-001');
    expect(result.timestamp).toBeDefined();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(result);
  });

  it('should reject with reason and emit improvement.rejected event', () => {
    const handler = vi.fn();
    eventBus.on('improvement.rejected', handler);

    const result = service.reject('SUG-002', 'Not applicable to our context');

    expect(result.action).toBe('rejected');
    expect(result.reason).toBe('Not applicable to our context');
    expect(result.suggestionId).toBe('SUG-002');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should request debate and emit improvement.debate-requested event', () => {
    const handler = vi.fn();
    eventBus.on('improvement.debate-requested', handler);

    const result = service.requestDebate('SUG-003');

    expect(result.action).toBe('debate-requested');
    expect(result.suggestionId).toBe('SUG-003');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should return ReviewAction with correct structure', () => {
    const result = service.approve('SUG-004');

    expect(result).toHaveProperty('suggestionId', 'SUG-004');
    expect(result).toHaveProperty('action', 'approved');
    expect(result).toHaveProperty('timestamp');
    expect(typeof result.timestamp).toBe('string');
  });
});
