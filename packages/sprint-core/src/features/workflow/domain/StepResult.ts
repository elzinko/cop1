export interface StepResult {
  status: 'ok' | 'failed' | 'blocked';
  error?: Error;
  /** Path to the DevAgent worktree when preserveWorktree is enabled */
  worktreePath?: string;
}
