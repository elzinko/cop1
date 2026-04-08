export class SupervisorTimeoutError extends Error {
  constructor(public readonly durationMs: number) {
    super(`Supervisor LLM timed out after ${durationMs}ms`);
    this.name = 'SupervisorTimeoutError';
  }
}
