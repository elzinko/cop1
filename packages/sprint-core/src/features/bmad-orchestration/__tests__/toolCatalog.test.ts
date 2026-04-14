import { EventBus } from '@cop1/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import type { WorktreeService } from '../../dev-agent/application/WorktreeService.js';
import type { HistoryService } from '../application/HistoryService.js';
import type { BMADSessionPort } from '../domain/ports/BMADSessionPort.js';
import { buildSupervisorToolHandlers } from '../infrastructure/tools/toolCatalog.js';

function makeDeps(): Parameters<typeof buildSupervisorToolHandlers>[0] {
  const worktree = {
    create: vi.fn(() => '/tmp/agent/story-1'),
    cleanup: vi.fn(),
    list: vi.fn(() => []),
  } as unknown as WorktreeService;
  const sessionPort = {
    startSession: vi.fn(async () => ({
      sessionId: 'sess-1',
      firstTurn: { completed: true, output: 'ok', durationMs: 1 },
    })),
    continueSession: vi.fn(),
  } as unknown as BMADSessionPort;
  const history = {
    byStory: vi.fn(async () => [{ sessionId: 'sess-1' }]),
    bySession: vi.fn(async () => []),
  } as unknown as HistoryService;
  return {
    worktree,
    sessionPort,
    history,
    projectRoot: '/proj',
    eventBus: new EventBus(),
  };
}

describe('buildSupervisorToolHandlers (EA10-S7 Layer 2a)', () => {
  it('create_worktree delegates to WorktreeService and emits events', async () => {
    const deps = makeDeps();
    const events: string[] = [];
    deps.eventBus?.on('supervisor.tool.invoked', () => events.push('invoked'));
    deps.eventBus?.on('supervisor.tool.completed', () => events.push('completed'));

    const handlers = buildSupervisorToolHandlers(deps);
    const result = await handlers.create_worktree({ storyId: 'EA10-S7', projectPath: '/proj' });

    expect(result.path).toBe('/tmp/agent/story-1');
    expect(deps.worktree.create).toHaveBeenCalledWith('/proj', 'EA10-S7');
    expect(events).toEqual(['invoked', 'completed']);
  });

  it('invoke_bmad_command returns sessionId and delegates to BMADSessionPort', async () => {
    const deps = makeDeps();
    const handlers = buildSupervisorToolHandlers(deps);
    const result = await handlers.invoke_bmad_command({
      command: '/bmad-bmm-dev-story',
      storyId: 'EA10-S7',
    });
    expect(result.sessionId).toBe('sess-1');
    expect(result.completed).toBe(true);
  });

  it('invoke_bmad_command enforces re-entrance cap (3) and throws beyond', async () => {
    const deps = makeDeps();
    const handlers = buildSupervisorToolHandlers({ ...deps, maxReentrance: 2 });
    // Simulate re-entrance by nesting calls
    (deps.sessionPort.startSession as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      // Recurse
      await handlers.invoke_bmad_command({ command: '/x', storyId: 'x' });
      return {
        sessionId: 's',
        firstTurn: { completed: true, output: 'ok', durationMs: 1 },
      };
    });
    await expect(handlers.invoke_bmad_command({ command: '/y', storyId: 'y' })).rejects.toThrow(
      /re-entrance depth/,
    );
  });

  it('query_session_history routes by storyId or sessionId', async () => {
    const deps = makeDeps();
    const handlers = buildSupervisorToolHandlers(deps);
    const out = await handlers.query_session_history({ storyId: 'EA10-S7' });
    expect(out.interactions).toHaveLength(1);
    expect(deps.history.byStory).toHaveBeenCalledWith('EA10-S7');
  });

  it('remaining_budget returns provided value or infinity', async () => {
    const deps = makeDeps();
    const handlers = buildSupervisorToolHandlers({
      ...deps,
      budgetProvider: () => 42,
    });
    const out = await handlers.remaining_budget({} as Record<string, never>);
    expect(out.tokensRemaining).toBe(42);

    const defaultHandlers = buildSupervisorToolHandlers(deps);
    const defaultOut = await defaultHandlers.remaining_budget({} as Record<string, never>);
    expect(defaultOut.tokensRemaining).toBe(Number.POSITIVE_INFINITY);
  });

  it('commit_anchor is a V1-light stub that reports the would-be commit', async () => {
    const deps = makeDeps();
    const handlers = buildSupervisorToolHandlers(deps);
    const out = await handlers.commit_anchor({ message: 'EA10-S7 — worktree commit' });
    expect(out.committed).toBe(false);
    expect(out.note).toContain('V1-light stub');
  });
});
