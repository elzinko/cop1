import { spawn } from 'node:child_process';
import type { CommitAnchorPort } from '../domain/CommitAnchor.js';

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Injectable git runner so unit tests never spawn a real process. */
export type GitRunner = (projectRoot: string, args: string[]) => Promise<GitResult>;

const defaultRunner: GitRunner = (projectRoot, args) =>
  new Promise((resolve) => {
    const child = spawn('git', args, { cwd: projectRoot });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', () => resolve({ code: 1, stdout, stderr }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });

/**
 * Commits the working tree via `git add -A && git commit`. Returns the short
 * SHA, or `null` when there is nothing to commit (clean index after staging) or
 * any git step fails — anchoring is best-effort and must never break the run.
 */
export class GitCommitAnchor implements CommitAnchorPort {
  private readonly run: GitRunner;

  constructor(run: GitRunner = defaultRunner) {
    this.run = run;
  }

  async commit(projectRoot: string, message: string): Promise<string | null> {
    const add = await this.run(projectRoot, ['add', '-A']);
    if (add.code !== 0) return null;
    // `git diff --cached --quiet` exits 0 when the index has NO staged changes.
    const staged = await this.run(projectRoot, ['diff', '--cached', '--quiet']);
    if (staged.code === 0) return null; // nothing to commit
    const committed = await this.run(projectRoot, ['commit', '-m', message]);
    if (committed.code !== 0) return null;
    const sha = await this.run(projectRoot, ['rev-parse', '--short', 'HEAD']);
    const trimmed = sha.stdout.trim();
    return sha.code === 0 && trimmed.length > 0 ? trimmed : null;
  }
}
