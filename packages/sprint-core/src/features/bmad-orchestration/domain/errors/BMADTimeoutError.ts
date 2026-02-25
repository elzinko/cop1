export class BMADTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Claude CLI timed out after ${timeoutMs}ms`);
    this.name = 'BMADTimeoutError';
  }
}
