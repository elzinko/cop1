import { EventBus } from '@cop1/shared-kernel';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptiveLLMService } from '../application/AdaptiveLLMService.js';

describe('AdaptiveLLMService', () => {
  const eventBus = new EventBus();

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  const fallbackConfig = {
    'dev-agent': 'claude-sonnet-4-5-20250929',
    'reviewer-agent': 'claude-haiku-4-5-20251001',
  };

  it('should not escalate on first failure', () => {
    const service = new AdaptiveLLMService(eventBus, fallbackConfig, 2);
    const result = service.recordFailure('dev-agent', 'S1');
    expect(result).toBeNull();
  });

  it('should escalate after threshold failures', () => {
    const handler = vi.fn();
    eventBus.on('llm.escalated', handler);

    const service = new AdaptiveLLMService(eventBus, fallbackConfig, 2);
    service.recordFailure('dev-agent', 'S1');
    const result = service.recordFailure('dev-agent', 'S1');

    expect(result).not.toBeNull();
    expect(result?.fallbackModel).toBe('claude-sonnet-4-5-20250929');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should return active fallback model after escalation', () => {
    const service = new AdaptiveLLMService(eventBus, fallbackConfig, 1);
    service.recordFailure('dev-agent', 'S1');

    expect(service.getActiveModel('dev-agent')).toBe('claude-sonnet-4-5-20250929');
  });

  it('should return null for non-escalated agent', () => {
    const service = new AdaptiveLLMService(eventBus, fallbackConfig);
    expect(service.getActiveModel('dev-agent')).toBeNull();
  });
});
