import { describe, expect, it } from 'vitest';
import { IterationLimiter, MaxIterationsError } from '../application/IterationLimiter.js';

describe('IterationLimiter', () => {
  it('should allow iterations below limit', () => {
    const limiter = new IterationLimiter(3);
    const result = limiter.check('S1', 'dev');
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
  });

  it('should throw MaxIterationsError when limit reached', () => {
    const limiter = new IterationLimiter(2);
    limiter.check('S1', 'dev');

    expect(() => limiter.check('S1', 'dev')).toThrow(MaxIterationsError);
  });

  it('should track per story and agent independently', () => {
    const limiter = new IterationLimiter(5);
    limiter.check('S1', 'dev');
    limiter.check('S1', 'dev');
    limiter.check('S1', 'reviewer');

    expect(limiter.getCount('S1', 'dev')).toBe(2);
    expect(limiter.getCount('S1', 'reviewer')).toBe(1);
  });

  it('should reset count', () => {
    const limiter = new IterationLimiter(5);
    limiter.check('S1', 'dev');
    limiter.check('S1', 'dev');
    limiter.reset('S1', 'dev');

    expect(limiter.getCount('S1', 'dev')).toBe(0);
  });
});
