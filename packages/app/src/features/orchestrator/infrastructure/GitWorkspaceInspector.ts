import { spawn } from 'node:child_process';
import type { WorkspaceInspectionPort } from '../domain/WorkspaceChanges.js';

/** Injectable runner returning raw `git status --porcelain` stdout. */
export type GitStatusRunner = (projectRoot: string) => Promise<string>;

const defaultRunner: GitStatusRunner = (projectRoot) =>
  new Promise((resolve) => {
    const child = spawn('git', ['status', '--porcelain'], { cwd: projectRoot });
    let out = '';
    child.stdout?.on('data', (d) => {
      out += d.toString();
    });
    child.on('error', () => resolve(''));
    child.on('close', () => resolve(out));
  });

/**
 * Lists changed working-tree paths via `git status --porcelain`. Used by the
 * command runner to prove a code-producing command actually edited files.
 * The git invocation is injectable so unit tests never spawn a real process.
 */
export class GitWorkspaceInspector implements WorkspaceInspectionPort {
  private readonly run: GitStatusRunner;

  constructor(run: GitStatusRunner = defaultRunner) {
    this.run = run;
  }

  async changedPaths(projectRoot: string): Promise<string[]> {
    return parsePorcelainPaths(await this.run(projectRoot));
  }
}

/**
 * Parse `git status --porcelain` (v1) output into changed paths. Each line is
 * `XY <path>` (two status columns + space), or `XY <orig> -> <dest>` for a
 * rename/copy (the destination is the live path). Quoted paths are unquoted.
 */
export function parsePorcelainPaths(porcelain: string): string[] {
  const paths: string[] = [];
  for (const line of porcelain.split('\n')) {
    if (line.trim().length === 0) continue;
    const body = line.length > 3 ? line.slice(3) : line.trim();
    const arrow = body.indexOf(' -> ');
    const raw = arrow >= 0 ? body.slice(arrow + 4) : body;
    const cleaned = raw.replace(/^"|"$/g, '').trim();
    if (cleaned.length > 0) paths.push(cleaned);
  }
  return paths;
}
