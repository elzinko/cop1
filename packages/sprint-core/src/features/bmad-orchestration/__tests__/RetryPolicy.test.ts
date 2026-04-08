import { describe, expect, it } from 'vitest';
import { RetryPolicy } from '../domain/RetryPolicy.js';

describe('RetryPolicy', () => {
  it('uses default options when none provided', () => {
    const policy = new RetryPolicy();

    expect(policy.maxRetries).toBe(3);
    expect(policy.baseDelayMs).toBe(1_000);
    expect(policy.backoffMultiplier).toBe(2);
  });

  it('accepts custom options', () => {
    const policy = new RetryPolicy({ maxRetries: 5, baseDelayMs: 500, backoffMultiplier: 3 });

    expect(policy.maxRetries).toBe(5);
    expect(policy.baseDelayMs).toBe(500);
    expect(policy.backoffMultiplier).toBe(3);
  });

  describe('getDelayMs', () => {
    it('computes exponential backoff delays', () => {
      const policy = new RetryPolicy({ baseDelayMs: 1000, backoffMultiplier: 2 });

      expect(policy.getDelayMs(0)).toBe(1000); // 1000 * 2^0
      expect(policy.getDelayMs(1)).toBe(2000); // 1000 * 2^1
      expect(policy.getDelayMs(2)).toBe(4000); // 1000 * 2^2
    });
  });

  describe('isTransientError', () => {
    it('detects HTTP 429 rate limit', () => {
      expect(new RetryPolicy().isTransientError('HTTP 429 rate limit exceeded')).toBe(true);
    });

    it('detects HTTP 503 service unavailable', () => {
      expect(new RetryPolicy().isTransientError('HTTP 503 Service Unavailable')).toBe(true);
    });

    it('detects timeout errors', () => {
      expect(new RetryPolicy().isTransientError('Claude CLI timed out after 600000ms')).toBe(true);
    });

    it('does not retry spawn errors (permanent)', () => {
      expect(new RetryPolicy().isTransientError('Claude CLI spawn error: ENOENT')).toBe(false);
    });

    it('detects ECONNRESET', () => {
      expect(new RetryPolicy().isTransientError('ECONNRESET: connection reset')).toBe(true);
    });

    it('detects crash exit codes (137 SIGKILL)', () => {
      expect(new RetryPolicy().isTransientError('Claude CLI exited with code 137: ')).toBe(true);
    });

    it('detects crash exit codes (139 SIGSEGV)', () => {
      expect(new RetryPolicy().isTransientError('Claude CLI exited with code 139: ')).toBe(true);
    });

    it('returns false for permanent errors', () => {
      expect(new RetryPolicy().isTransientError('Invalid command syntax')).toBe(false);
    });

    it('returns false for normal exit code 1', () => {
      expect(new RetryPolicy().isTransientError('Claude CLI exited with code 1: error')).toBe(
        false,
      );
    });
  });
});
