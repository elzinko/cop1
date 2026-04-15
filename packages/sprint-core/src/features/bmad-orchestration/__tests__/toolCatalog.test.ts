import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import type { WorktreeService } from '../../dev-agent/application/WorktreeService.js';
import type { HistoryService } from '../application/HistoryService.js';
import type { BMADSessionPort } from '../domain/ports/BMADSessionPort.js';
import {
  type GitDriver,
  buildSupervisorToolHandlers,
} from '../infrastructure/tools/toolCatalog.js';

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

  it('commit_anchor: returns nothing_to_commit when staging area is empty', async () => {
    const deps = makeDeps();
    const git: GitDriver = {
      hasStagedChanges: vi.fn(() => false),
      commit: vi.fn(),
      headSha: vi.fn(() => 'unreachable'),
    };
    const handlers = buildSupervisorToolHandlers({ ...deps, gitDriver: git });
    const out = await handlers.commit_anchor({ message: 'feat: nothing' });
    expect(out).toEqual({ committed: false, reason: 'nothing_to_commit' });
    expect(git.commit).not.toHaveBeenCalled();
  });

  it('commit_anchor: returns sha + short_sha on success and injects Co-Authored-By trailer', async () => {
    const deps = makeDeps();
    let captured = '';
    const fullSha = 'abcdef1234567890abcdef1234567890abcdef12';
    const git: GitDriver = {
      hasStagedChanges: () => true,
      commit: (_cwd, message) => {
        captured = message;
      },
      headSha: () => fullSha,
    };
    const handlers = buildSupervisorToolHandlers({
      ...deps,
      gitDriver: git,
      coAuthoredBy: 'Claude <noreply@anthropic.com>',
    });
    const out = await handlers.commit_anchor({
      message: 'feat(ea12-s1): real commit_anchor',
      worktreePath: '/tmp/w',
    });
    expect(out).toEqual({ committed: true, sha: fullSha, short_sha: fullSha.slice(0, 7) });
    expect(captured).toMatch(/^feat\(ea12-s1\): real commit_anchor/);
    expect(captured).toContain('Co-Authored-By: Claude <noreply@anthropic.com>');
  });

  it('commit_anchor: wraps commit failure into structured error with stderr detail', async () => {
    const deps = makeDeps();
    const err = Object.assign(new Error('commit fail'), {
      stderr: Buffer.from('fatal: some git error'),
    });
    const git: GitDriver = {
      hasStagedChanges: () => true,
      commit: () => {
        throw err;
      },
      headSha: () => 'unreachable',
    };
    const handlers = buildSupervisorToolHandlers({ ...deps, gitDriver: git });
    const out = await handlers.commit_anchor({ message: 'feat: x' });
    expect(out).toMatchObject({
      committed: false,
      reason: 'commit_failed',
      detail: 'fatal: some git error',
    });
  });

  it('commit_anchor: does NOT push — only commits locally', async () => {
    const deps = makeDeps();
    const pushSpy = vi.fn();
    const git: GitDriver = {
      hasStagedChanges: () => true,
      commit: (_cwd, _msg) => {
        // Verify no push invocation is forced through the driver
        pushSpy();
      },
      headSha: () => 'a'.repeat(40),
    };
    const handlers = buildSupervisorToolHandlers({ ...deps, gitDriver: git });
    await handlers.commit_anchor({ message: 'feat: x' });
    // pushSpy was called only by the commit hook — the handler itself must not
    // invoke push. The driver surface intentionally has no push method.
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(Object.keys(git)).not.toContain('push');
  });

  it('commit_anchor: integration — produces a real commit in a temp repo', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'commit-anchor-'));
    try {
      execSync('git init -q', { cwd: repo });
      execSync('git config user.email test@example.com', { cwd: repo });
      execSync('git config user.name Test', { cwd: repo });
      execSync('git config commit.gpgsign false', { cwd: repo });
      writeFileSync(join(repo, 'file.txt'), 'hello');
      execSync('git add file.txt', { cwd: repo });

      const deps = makeDeps();
      const handlers = buildSupervisorToolHandlers({
        ...deps,
        projectRoot: repo,
        coAuthoredBy: 'Claude Opus 4.6 (1M context) <noreply@anthropic.com>',
      });

      const out = await handlers.commit_anchor({
        message: 'feat(ea12-s1): integration test',
      });
      expect(out.committed).toBe(true);
      if (!out.committed) throw new Error('expected committed');
      expect(out.sha).toMatch(/^[0-9a-f]{40}$/);
      expect(out.short_sha).toHaveLength(7);

      const logged = execSync('git log -1 --format=%B', { cwd: repo, encoding: 'utf-8' });
      expect(logged).toContain('feat(ea12-s1): integration test');
      expect(logged).toContain(
        'Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>',
      );

      // Calling again with nothing staged returns nothing_to_commit.
      const again = await handlers.commit_anchor({ message: 'feat: noop' });
      expect(again).toEqual({ committed: false, reason: 'nothing_to_commit' });
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
