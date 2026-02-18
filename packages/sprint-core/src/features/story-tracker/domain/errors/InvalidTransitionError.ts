export class InvalidTransitionError extends Error {
  constructor(
    public readonly storyId: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Invalid status transition for story "${storyId}": ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}
