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

    it('detects Anthropic overloaded_error (529)', () => {
      const policy = new RetryPolicy();
      expect(policy.isTransientError('API Error: 529 {"type":"overloaded_error"}')).toBe(true);
      expect(policy.isTransientError('the service is overloaded, try again')).toBe(true);
    });

    it('detects 5xx server errors (500/502/504)', () => {
      const policy = new RetryPolicy();
      expect(policy.isTransientError('API Error: 500 internal server error')).toBe(true);
      expect(policy.isTransientError('502 Bad Gateway')).toBe(true);
      expect(policy.isTransientError('504 Gateway Timeout')).toBe(true);
    });

    it('detects generic "temporarily unavailable" blockage', () => {
      expect(new RetryPolicy().isTransientError('claude-opus-4-8 is temporarily unavailable')).toBe(
        true,
      );
    });

    it('detects more network errors (ETIMEDOUT, ENOTFOUND, socket hang up)', () => {
      const policy = new RetryPolicy();
      expect(policy.isTransientError('connect ETIMEDOUT 1.2.3.4:443')).toBe(true);
      expect(policy.isTransientError('getaddrinfo ENOTFOUND api.anthropic.com')).toBe(true);
      expect(policy.isTransientError('socket hang up')).toBe(true);
    });

    it('keeps the "tool_use ids must be unique" 400 non-transient (a hard bug, not a blip)', () => {
      expect(
        new RetryPolicy().isTransientError('API Error: 400 `tool_use` ids must be unique'),
      ).toBe(false);
    });
  });
});
