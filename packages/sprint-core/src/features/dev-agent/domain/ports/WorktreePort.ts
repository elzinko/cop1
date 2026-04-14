export interface WorktreePort {
  create(projectPath: string, storyId: string): string;
  cleanup(projectPath: string, worktreePath: string): void;
  list(projectPath: string): string[];
}
