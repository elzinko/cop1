import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Single source of truth for worktree paths (ADR-019).
 *
 * Worktrees live under the gitignored `.cop1/` runtime dir, scoped by `runId`
 * so two concurrent runs on the same project never share a base directory.
 */
export function worktreeBaseDir(projectPath: string, runId: string): string {
  return join(projectPath, '.cop1', 'worktrees', runId);
}

export function worktreePath(baseDir: string, storyId: string): string {
  return join(baseDir, `${storyId}-${randomUUID().slice(0, 8)}`);
}

/**
 * Stateful per-run worktree manager (ADR-019).
 *
 * The constructor freezes a unique `runId`, giving this instance an isolated
 * base dir `<projectPath>/.cop1/worktrees/<runId>/`. MUST be constructed once
 * per run: two runs = two managers = two runIds = disjoint bases, even for the
 * same `projectPath` + same `storyId`. The `WorktreePort` contract is unchanged;
 * `runId` is an implementation detail.
 */
export class WorktreeManager {
  private readonly runId = randomUUID();

  create(projectPath: string, storyId: string): string {
    const baseDir = worktreeBaseDir(projectPath, this.runId);
    const target = worktreePath(baseDir, storyId);

    // git worktree add requires the parent directory to exist.
    mkdirSync(baseDir, { recursive: true });

    // execFileSync (no shell): `target` is passed as a literal argv entry, so a
    // storyId/path with shell metacharacters can never be interpreted (ADR-019).
    execFileSync('git', ['worktree', 'add', target, 'HEAD'], {
      cwd: projectPath,
      stdio: 'pipe',
    });

    return target;
  }

  cleanup(projectPath: string, target: string): void {
    if (existsSync(target)) {
      execFileSync('git', ['worktree', 'remove', target, '--force'], {
        cwd: projectPath,
        stdio: 'pipe',
      });
    }

    // Drop any stale administrative references (no-orphan, AC2).
    execFileSync('git', ['worktree', 'prune'], { cwd: projectPath, stdio: 'pipe' });

    // Remove the run base only if empty — a kept worktree (ADR-018) must survive.
    removeIfEmpty(worktreeBaseDir(projectPath, this.runId));
  }

  list(projectPath: string): string[] {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: projectPath,
      encoding: 'utf-8',
    });

    return output
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.replace('worktree ', ''));
  }
}

function removeIfEmpty(dir: string): void {
  try {
    if (existsSync(dir) && readdirSync(dir).length === 0) {
      rmdirSync(dir);
    }
  } catch {
    // best-effort: a non-empty or concurrently-used base is left in place.
  }
}
