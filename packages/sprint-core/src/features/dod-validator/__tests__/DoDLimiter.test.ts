import { EventBus } from '@cop1/shared-kernel';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DoDLimiter } from '../application/DoDLimiter.js';

describe('DoDLimiter', () => {
  const eventBus = new EventBus();

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('should not exceed on first rejection', () => {
    const limiter = new DoDLimiter(eventBus, 3);
    const result = limiter.check('S1');
    expect(result.exceeded).toBe(false);
    expect(result.count).toBe(1);
  });

  it('should exceed after max rejections', () => {
    const handler = vi.fn();
    eventBus.on('dod.max_rejections', handler);

    const limiter = new DoDLimiter(eventBus, 2);
    limiter.check('S1');
    const result = limiter.check('S1');

    expect(result.exceeded).toBe(true);
    expect(result.count).toBe(2);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should track counts per story independently', () => {
    const limiter = new DoDLimiter(eventBus, 3);
    limiter.check('S1');
    limiter.check('S1');
    limiter.check('S2');

    expect(limiter.getCount('S1')).toBe(2);
    expect(limiter.getCount('S2')).toBe(1);
  });

  it('should reset count for a story', () => {
    const limiter = new DoDLimiter(eventBus, 3);
    limiter.check('S1');
    limiter.check('S1');
    limiter.reset('S1');

    expect(limiter.getCount('S1')).toBe(0);
  });
});
