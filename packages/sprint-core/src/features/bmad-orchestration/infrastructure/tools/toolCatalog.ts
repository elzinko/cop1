import type { EventBus } from '@cop1/shared-kernel';
import { z } from 'zod';
import type { WorktreeService } from '../../../dev-agent/application/WorktreeService.js';
import type { HistoryService } from '../../application/HistoryService.js';
import type { BMADSessionPort } from '../../domain/ports/BMADSessionPort.js';

/**
 * EA10-S7 — V1-light tool catalog for the supervisor MCP server (ADR-014 §4.4).
 *
 * Layer 2a wrappers around Layer 1 services. Each tool is built via the
 * `@anthropic-ai/claude-agent-sdk` `tool()` helper and aggregated by
 * `buildSupervisorMcpServer` in `SupervisorMcpServer.ts`.
 *
 * Kept SDK-free here: tools are produced lazily via `buildToolDefinitions`,
 * so the SDK `tool()` import is deferred to the MCP server entrypoint.
 */
export interface ToolCatalogDeps {
  worktree: WorktreeService;
  sessionPort: BMADSessionPort;
  history: HistoryService;
  projectRoot: string;
  eventBus?: EventBus;
  /** Maximum re-entrance depth for invoke_bmad_command (ADR-014 §5.7). */
  maxReentrance?: number;
}

export interface SupervisorToolHandlers {
  create_worktree: (input: { storyId: string; projectPath: string }) => Promise<{ path: string }>;
  cleanup_worktree: (input: {
    projectPath: string;
    worktreePath: string;
  }) => Promise<{ cleaned: boolean }>;
  invoke_bmad_command: (input: {
    command: string;
    storyId: string;
  }) => Promise<{ sessionId: string; completed: boolean; output?: string }>;
  query_session_history: (input: {
    storyId?: string;
    sessionId?: string;
  }) => Promise<{ interactions: unknown[] }>;
  commit_anchor: (input: { message: string }) => Promise<{ committed: boolean; note?: string }>;
  remaining_budget: (input: Record<string, never>) => Promise<{ tokensRemaining: number }>;
}

/**
 * Produce the Layer 1 + re-entrance-guarded Layer 2 handler set.
 * Consumers (MCP server builder) wrap each handler with the SDK `tool()` call.
 */
export function buildSupervisorToolHandlers(
  deps: ToolCatalogDeps & { budgetProvider?: () => number },
): SupervisorToolHandlers {
  const maxReentrance = deps.maxReentrance ?? 3;
  let currentDepth = 0;

  const emit = (name: string, payload: Record<string, unknown>) => {
    deps.eventBus?.emit(name, payload);
  };

  return {
    async create_worktree({ storyId, projectPath }) {
      emit('supervisor.tool.invoked', { tool: 'create_worktree', storyId });
      const path = deps.worktree.create(projectPath, storyId);
      emit('supervisor.tool.completed', { tool: 'create_worktree', storyId, path });
      return { path };
    },

    async cleanup_worktree({ projectPath, worktreePath }) {
      emit('supervisor.tool.invoked', { tool: 'cleanup_worktree', worktreePath });
      deps.worktree.cleanup(projectPath, worktreePath);
      emit('supervisor.tool.completed', { tool: 'cleanup_worktree', worktreePath });
      return { cleaned: true };
    },

    async invoke_bmad_command({ command, storyId }) {
      if (currentDepth >= maxReentrance) {
        emit('supervisor.tool.failed', {
          tool: 'invoke_bmad_command',
          reason: 're-entrance depth cap',
          depth: currentDepth,
        });
        throw new Error(
          `invoke_bmad_command re-entrance depth ${currentDepth} >= ${maxReentrance} — escalate instead of looping`,
        );
      }
      currentDepth++;
      emit('supervisor.tool.invoked', { tool: 'invoke_bmad_command', command, storyId });
      try {
        const handle = await deps.sessionPort.startSession(command, {
          storyId,
          projectPath: deps.projectRoot,
        });
        emit('supervisor.tool.completed', {
          tool: 'invoke_bmad_command',
          command,
          storyId,
          sessionId: handle.sessionId,
        });
        return {
          sessionId: handle.sessionId,
          completed: handle.firstTurn?.completed ?? false,
          output: handle.firstTurn?.output,
        };
      } finally {
        currentDepth--;
      }
    },

    async query_session_history({ storyId, sessionId }) {
      emit('supervisor.tool.invoked', { tool: 'query_session_history', storyId, sessionId });
      const rows = storyId
        ? await deps.history.byStory(storyId)
        : sessionId
          ? await deps.history.bySession(sessionId)
          : [];
      emit('supervisor.tool.completed', {
        tool: 'query_session_history',
        count: rows.length,
      });
      return { interactions: rows };
    },

    async commit_anchor({ message }) {
      emit('supervisor.tool.invoked', { tool: 'commit_anchor' });
      // V1-light: placeholder — real git integration deferred. Return note so
      // caller knows this is a no-op for now.
      emit('supervisor.tool.completed', { tool: 'commit_anchor' });
      return { committed: false, note: `V1-light stub — would commit: ${message}` };
    },

    async remaining_budget() {
      emit('supervisor.tool.invoked', { tool: 'remaining_budget' });
      const tokensRemaining = deps.budgetProvider?.() ?? Number.POSITIVE_INFINITY;
      emit('supervisor.tool.completed', { tool: 'remaining_budget', tokensRemaining });
      return { tokensRemaining };
    },
  };
}

/**
 * Zod schemas — exported for the MCP server builder (`buildSupervisorMcpServer`).
 */
export const toolSchemas = {
  create_worktree: {
    storyId: z.string(),
    projectPath: z.string(),
  },
  cleanup_worktree: {
    projectPath: z.string(),
    worktreePath: z.string(),
  },
  invoke_bmad_command: {
    command: z.string(),
    storyId: z.string(),
  },
  query_session_history: {
    storyId: z.string().optional(),
    sessionId: z.string().optional(),
  },
  commit_anchor: {
    message: z.string(),
  },
  remaining_budget: {} as Record<string, never>,
};
