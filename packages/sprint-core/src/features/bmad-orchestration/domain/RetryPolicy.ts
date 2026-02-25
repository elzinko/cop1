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

/** Transient error patterns that warrant retry. */
const TRANSIENT_PATTERNS = [
  /\b429\b/,
  /rate.?limit/i,
  /\b503\b/,
  /service.?unavailable/i,
  /timed?\s*out/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
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
    return this.baseDelayMs * Math.pow(this.backoffMultiplier, attempt);
  }

  /** Determine if an error message indicates a transient failure. */
  isTransientError(errorOutput: string): boolean {
    return TRANSIENT_PATTERNS.some((pattern) => pattern.test(errorOutput));
  }
}
