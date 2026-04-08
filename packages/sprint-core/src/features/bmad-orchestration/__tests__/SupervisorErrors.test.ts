import { describe, expect, it } from 'vitest';
import { SupervisorRateLimitError } from '../domain/errors/SupervisorRateLimitError.js';
import { SupervisorTimeoutError } from '../domain/errors/SupervisorTimeoutError.js';

describe('SupervisorTimeoutError', () => {
  it('should set name, message, and durationMs', () => {
    const error = new SupervisorTimeoutError(5000);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SupervisorTimeoutError');
    expect(error.message).toBe('Supervisor LLM timed out after 5000ms');
    expect(error.durationMs).toBe(5000);
  });
});

describe('SupervisorRateLimitError', () => {
  it('should set name, message, and durationMs without retryAfterMs', () => {
    const error = new SupervisorRateLimitError(3000);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SupervisorRateLimitError');
    expect(error.message).toBe('Supervisor LLM rate limited');
    expect(error.durationMs).toBe(3000);
    expect(error.retryAfterMs).toBeUndefined();
  });

  it('should include retryAfterMs in message when provided', () => {
    const error = new SupervisorRateLimitError(3000, 60000);

    expect(error.message).toBe('Supervisor LLM rate limited, retry after 60000ms');
    expect(error.retryAfterMs).toBe(60000);
  });
});
