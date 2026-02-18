export class LLMUnavailableError extends Error {
  constructor(
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(`LLM provider "${provider}" is unavailable`);
    this.name = 'LLMUnavailableError';
  }
}
