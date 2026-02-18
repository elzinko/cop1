export class IntegrityError extends Error {
  constructor(
    public readonly storyId: string,
    public readonly expectedChecksum: string,
    public readonly actualChecksum: string,
  ) {
    super(
      `Integrity check failed for story "${storyId}": expected ${expectedChecksum}, got ${actualChecksum}`,
    );
    this.name = 'IntegrityError';
  }
}
