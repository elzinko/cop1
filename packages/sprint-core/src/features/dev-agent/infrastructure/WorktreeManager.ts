import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export class WorktreeManager {
  create(projectPath: string, storyId: string): string {
    const timestamp = Date.now();
    const worktreeName = `${storyId}-${timestamp}`;
    const worktreePath = join(projectPath, 'agent', worktreeName);

    execSync(`git worktree add "${worktreePath}" HEAD`, {
      cwd: projectPath,
      stdio: 'pipe',
    });

    return worktreePath;
  }

  cleanup(projectPath: string, worktreePath: string): void {
    if (!existsSync(worktreePath)) return;

    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: projectPath,
      stdio: 'pipe',
    });
  }

  list(projectPath: string): string[] {
    const output = execSync('git worktree list --porcelain', {
      cwd: projectPath,
      encoding: 'utf-8',
    });

    return output
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.replace('worktree ', ''));
  }
}
