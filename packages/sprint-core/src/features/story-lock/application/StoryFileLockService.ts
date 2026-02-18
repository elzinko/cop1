import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LockConflictError, type LockInfo } from '../domain/StoryFileLock.js';

const LOCKS_DIR = '.cop1/locks';

export class StoryFileLockService {
  private readonly locksDir: string;

  constructor(
    private readonly projectPath: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.locksDir = join(projectPath, LOCKS_DIR);
  }

  acquire(storyId: string, owner: string, ttlMinutes = 10): LockInfo {
    if (!existsSync(this.locksDir)) {
      mkdirSync(this.locksDir, { recursive: true });
    }

    const lockPath = this.lockPath(storyId);
    const existing = this.readLock(lockPath);

    if (existing) {
      const expiresAt = new Date(existing.expiresAt);
      if (expiresAt > this.now()) {
        throw new LockConflictError(storyId, existing);
      }
      // Expired lock — overwrite
    }

    const now = this.now();
    const lock: LockInfo = {
      storyId,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
      owner,
    };

    writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf-8');
    return lock;
  }

  release(storyId: string): void {
    const lockPath = this.lockPath(storyId);
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  }

  isLocked(storyId: string): boolean {
    const lockPath = this.lockPath(storyId);
    const lock = this.readLock(lockPath);
    if (!lock) return false;
    return new Date(lock.expiresAt) > this.now();
  }

  private lockPath(storyId: string): string {
    return join(this.locksDir, `${storyId}.lock`);
  }

  private readLock(path: string): LockInfo | null {
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as LockInfo;
    } catch {
      return null;
    }
  }
}
