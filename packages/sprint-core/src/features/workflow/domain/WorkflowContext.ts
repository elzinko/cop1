import type { Cop1Config } from '@cop1/shared-kernel';

export interface WorkflowContext {
  storyId: string;
  projectPath: string;
  config: Cop1Config;
  /** When true, DevAgent preserves its worktree for inspection */
  preserveWorktree?: boolean;
}
