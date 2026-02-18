import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StoryFileLockService } from '../application/StoryFileLockService.js';
import { LockConflictError } from '../domain/StoryFileLock.js';

describe('StoryFileLockService', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-lock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should acquire a lock successfully', () => {
    const service = new StoryFileLockService(testDir);
    const lock = service.acquire('E1-S1', 'dev-agent');

    expect(lock.storyId).toBe('E1-S1');
    expect(lock.owner).toBe('dev-agent');
    expect(service.isLocked('E1-S1')).toBe(true);
  });

  it('should throw LockConflictError when lock is active', () => {
    const service = new StoryFileLockService(testDir);
    service.acquire('E1-S1', 'dev-agent');

    expect(() => service.acquire('E1-S1', 'reviewer-agent')).toThrow(LockConflictError);
  });

  it('should allow acquiring expired lock', () => {
    let time = new Date('2025-01-01T00:00:00Z');
    const service = new StoryFileLockService(testDir, () => time);

    service.acquire('E1-S1', 'dev-agent', 10);

    // Advance time by 11 minutes
    time = new Date('2025-01-01T00:11:00Z');

    const lock = service.acquire('E1-S1', 'reviewer-agent');
    expect(lock.owner).toBe('reviewer-agent');
  });

  it('should release a lock', () => {
    const service = new StoryFileLockService(testDir);
    service.acquire('E1-S1', 'dev-agent');
    service.release('E1-S1');

    expect(service.isLocked('E1-S1')).toBe(false);
  });

  it('should report unlocked for unknown story', () => {
    const service = new StoryFileLockService(testDir);
    expect(service.isLocked('unknown')).toBe(false);
  });

  it('should handle release of non-existent lock gracefully', () => {
    const service = new StoryFileLockService(testDir);
    expect(() => service.release('unknown')).not.toThrow();
  });
});
