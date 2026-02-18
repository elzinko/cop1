export interface LockInfo {
  storyId: string;
  acquiredAt: string;
  expiresAt: string;
  owner: string;
}

export class LockConflictError extends Error {
  constructor(
    public readonly storyId: string,
    public readonly existingLock: LockInfo,
  ) {
    super(
      `Lock conflict for story ${storyId}: held by ${existingLock.owner} until ${existingLock.expiresAt}`,
    );
    this.name = 'LockConflictError';
  }
}
