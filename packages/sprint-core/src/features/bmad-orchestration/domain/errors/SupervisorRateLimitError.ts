export class SupervisorRateLimitError extends Error {
  constructor(
    public readonly durationMs: number,
    public readonly retryAfterMs?: number,
  ) {
    super(
      retryAfterMs
        ? `Supervisor LLM rate limited, retry after ${retryAfterMs}ms`
        : 'Supervisor LLM rate limited',
    );
    this.name = 'SupervisorRateLimitError';
  }
}
