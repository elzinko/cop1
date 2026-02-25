export class BMADRetryExhaustedError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(`BMAD command failed after ${attempts} attempts: ${lastError.message}`);
    this.name = 'BMADRetryExhaustedError';
  }
}
