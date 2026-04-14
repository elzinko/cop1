import type { WorktreePort } from '../domain/ports/WorktreePort.js';
import { WorktreeManager } from '../infrastructure/WorktreeManager.js';

/**
 * Application-layer service for git worktree lifecycle.
 * Wraps `WorktreeManager` (the primary adapter) behind the `WorktreePort` interface
 * so that EA10 orchestrator tools (ADR-014 MCP bridge) can consume a stable contract.
 *
 * Introduced by EA11-S3. Legacy `DevAgent` and `SprintRunner` continue to work unchanged
 * because the adapter semantics are identical.
 */
export class WorktreeService implements WorktreePort {
  constructor(private readonly adapter: WorktreePort = new WorktreeManager()) {}

  create(projectPath: string, storyId: string): string {
    return this.adapter.create(projectPath, storyId);
  }

  cleanup(projectPath: string, worktreePath: string): void {
    this.adapter.cleanup(projectPath, worktreePath);
  }

  list(projectPath: string): string[] {
    return this.adapter.list(projectPath);
  }
}
