export interface RetryPolicyOptions {
  maxRetries: number;
  baseDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_OPTIONS: RetryPolicyOptions = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  backoffMultiplier: 2,
};

/**
 * Transient error patterns that warrant retry. Covers HTTP rate-limit / 5xx,
 * Anthropic `overloaded_error` (529), generic "temporarily unavailable"
 * blockages, and Node network errors. Deliberately excludes ambiguous failures
 * (plain `exited with code 1`, 4xx invalid-request) which are not safe to retry.
 */
const TRANSIENT_PATTERNS = [
  /\b429\b/,
  /rate.?limit/i,
  /\b5(?:00|02|03|04|29)\b/,
  /service.?unavailable/i,
  /overloaded/i,
  /temporarily unavailable/i,
  /timed?\s*out/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  /socket hang up/i,
  /exited with code (?:130|137|139|134|143)\b/,
];

export class RetryPolicy {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly backoffMultiplier: number;

  constructor(options?: Partial<RetryPolicyOptions>) {
    this.maxRetries = options?.maxRetries ?? DEFAULT_OPTIONS.maxRetries;
    this.baseDelayMs = options?.baseDelayMs ?? DEFAULT_OPTIONS.baseDelayMs;
    this.backoffMultiplier = options?.backoffMultiplier ?? DEFAULT_OPTIONS.backoffMultiplier;
  }

  /** Calculate delay in ms for the given attempt (0-indexed). */
  getDelayMs(attempt: number): number {
    return this.baseDelayMs * this.backoffMultiplier ** attempt;
  }

  /** Determine if an error message indicates a transient failure. */
  isTransientError(errorOutput: string): boolean {
    return TRANSIENT_PATTERNS.some((pattern) => pattern.test(errorOutput));
  }
}
