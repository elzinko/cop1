import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MergeService } from '../application/MergeService.js';

describe('MergeService', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-merge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should create a pending merge proposal when autoMerge is false', () => {
    const service = new MergeService(testDir, false);

    const proposal = service.proposeOrMerge('E1-S1', '/tmp/worktree', 'feature/E1-S1');

    expect(proposal.status).toBe('pending');
    expect(proposal.storyId).toBe('E1-S1');
    expect(proposal.branchName).toBe('feature/E1-S1');
  });

  it('should persist proposal to disk', () => {
    const service = new MergeService(testDir, false);
    service.proposeOrMerge('E1-S1', '/tmp/wt', 'feature/E1-S1');

    const all = service.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.storyId).toBe('E1-S1');
  });

  it('should list pending proposals', () => {
    const service = new MergeService(testDir, false);
    service.proposeOrMerge('E1-S1', '/tmp/wt1', 'feature/E1-S1');
    service.proposeOrMerge('E1-S2', '/tmp/wt2', 'feature/E1-S2');

    expect(service.getPending()).toHaveLength(2);
  });

  it('should return empty list when no proposals exist', () => {
    const service = new MergeService(testDir, false);
    expect(service.listAll()).toHaveLength(0);
    expect(service.getPending()).toHaveLength(0);
  });
});
