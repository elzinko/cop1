export class MaxIterationsError extends Error {
  constructor(
    public readonly storyId: string,
    public readonly agentName: string,
    public readonly count: number,
  ) {
    super(`Max iterations reached for ${agentName} on ${storyId}: ${count}`);
    this.name = 'MaxIterationsError';
  }
}

export class IterationLimiter {
  private counts = new Map<string, number>();

  constructor(private readonly maxIterations: number = 5) {}

  check(storyId: string, agentName: string): { allowed: boolean; count: number } {
    const key = `${storyId}:${agentName}`;
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);

    if (count >= this.maxIterations) {
      throw new MaxIterationsError(storyId, agentName, count);
    }

    return { allowed: true, count };
  }

  getCount(storyId: string, agentName: string): number {
    return this.counts.get(`${storyId}:${agentName}`) ?? 0;
  }

  reset(storyId: string, agentName: string): void {
    this.counts.delete(`${storyId}:${agentName}`);
  }
}
