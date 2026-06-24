import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorktreeManager } from '../infrastructure/WorktreeManager.js';

/**
 * Real git integration tests for WorktreeManager (ADR-019).
 * Each test owns a throwaway repo with a LOCAL git identity (no global config
 * needed, matters in CI).
 */
function createGitRepo(): string {
  const dir = join(
    tmpdir(),
    `cop1-worktree-mgr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  // Canonicalize: git reports realpaths, so the repo root must match for path
  // comparisons against `git worktree list` (macOS /var → /private/var).
  const repo = realpathSync(dir);
  execSync('git init', { cwd: repo, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: repo, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: repo, stdio: 'pipe' });
  writeFileSync(join(repo, 'README.md'), '# Test\n');
  execSync('git add -A && git commit -m "initial"', { cwd: repo, stdio: 'pipe' });
  return repo;
}

function gitWorktreeList(projectPath: string): string[] {
  return execSync('git worktree list --porcelain', { cwd: projectPath, encoding: 'utf-8' })
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.replace('worktree ', ''));
}

describe('WorktreeManager (real git, ADR-019)', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = createGitRepo();
  });

  afterEach(() => {
    try {
      for (const wt of gitWorktreeList(projectPath)) {
        if (wt !== projectPath) {
          execSync(`git worktree remove "${wt}" --force`, { cwd: projectPath, stdio: 'pipe' });
        }
      }
    } catch {
      // best effort
    }
    rmSync(projectPath, { recursive: true, force: true });
  });

  it('Location: create() returns a path under .cop1/worktrees and never under agent/', () => {
    const mgr = new WorktreeManager();
    const wt = mgr.create(projectPath, 'EA11-S3');

    expect(wt.startsWith(join(projectPath, '.cop1', 'worktrees'))).toBe(true);
    expect(wt).not.toContain(`${sep}agent${sep}`);
    expect(existsSync(wt)).toBe(true);
  });

  it('Concurrency (AC1): two managers, same project + same story, create disjoint bases', () => {
    const mgrA = new WorktreeManager();
    const mgrB = new WorktreeManager();

    const wtA = mgrA.create(projectPath, 'EA11-S3');
    const wtB = mgrB.create(projectPath, 'EA11-S3');

    // Different paths entirely (disjoint run bases).
    expect(wtA).not.toBe(wtB);
    // Neither is a prefix of the other → fully disjoint run bases.
    expect(wtB.startsWith(`${wtA}${sep}`)).toBe(false);
    expect(wtA.startsWith(`${wtB}${sep}`)).toBe(false);

    // Both registered in git, both on disk → neither overwrote the other.
    const list = gitWorktreeList(projectPath);
    expect(list).toContain(wtA);
    expect(list).toContain(wtB);
    expect(existsSync(wtA)).toBe(true);
    expect(existsSync(wtB)).toBe(true);
  });

  it('Collision-proof: two create() on the SAME instance yield distinct paths', () => {
    const mgr = new WorktreeManager();
    const first = mgr.create(projectPath, 'EA11-S3');
    const second = mgr.create(projectPath, 'EA11-S3');

    expect(first).not.toBe(second);
    expect(existsSync(first)).toBe(true);
    expect(existsSync(second)).toBe(true);
  });

  it('No-orphan (AC2): cleanup of the last worktree removes the empty run base and prunes git', () => {
    const mgr = new WorktreeManager();
    const wt = mgr.create(projectPath, 'EA11-S3');
    const runBase = join(wt, '..'); // <projectPath>/.cop1/worktrees/<runId>

    expect(gitWorktreeList(projectPath)).toContain(wt);

    mgr.cleanup(projectPath, wt);

    // git no longer references it (remove + prune).
    expect(gitWorktreeList(projectPath)).not.toContain(wt);
    // The empty run base directory is gone.
    expect(existsSync(runBase)).toBe(false);
    expect(existsSync(wt)).toBe(false);
  });

  it('Keep coexists: a kept worktree stays under .cop1/worktrees and its base is not deleted', () => {
    const mgr = new WorktreeManager();
    const kept = mgr.create(projectPath, 'EA11-S1');
    const cleaned = mgr.create(projectPath, 'EA11-S2');

    // Cleanup only the second one (the first is intentionally kept on failure).
    mgr.cleanup(projectPath, cleaned);

    // Kept worktree survives, still under .cop1/worktrees, still on disk.
    expect(existsSync(kept)).toBe(true);
    expect(kept.startsWith(join(projectPath, '.cop1', 'worktrees'))).toBe(true);
    expect(gitWorktreeList(projectPath)).toContain(kept);

    // Run base must NOT be deleted while a kept worktree remains.
    const runBase = join(kept, '..');
    expect(existsSync(runBase)).toBe(true);
  });
});
