import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import type { WorktreePort } from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type BMADCommandRunner, OrchestratorService } from '../application/OrchestratorService.js';
import type { SupervisorPlaybook } from '../domain/SupervisorPlaybook.js';

function singlePhasePlaybook(): SupervisorPlaybook {
  return {
    version: '6.0.0',
    helpRef: '/bmad-help',
    phases: [
      {
        name: 'Development Loop',
        commands: [{ command: '/bmad-bmm-dev-story' }],
      },
    ],
    hooks: {},
  };
}

async function seedStatusFile(dir: string): Promise<string> {
  const artifactsDir = join(dir, '_bmad-output', 'implementation-artifacts');
  await mkdir(artifactsDir, { recursive: true });
  const path = join(artifactsDir, 'sprint-status.yaml');
  await writeFile(
    path,
    [
      'development_status:',
      '  epic-ea99: in-progress',
      '  EA99-S1: ready-for-dev',
      '  EA99-S2: ready-for-dev',
      '',
    ].join('\n'),
  );
  return path;
}

/**
 * Synthetic worktree path used by the in-memory spy. Mirrors the ADR-019
 * location (`.cop1/worktrees/...`) so the test never re-encodes the dead
 * `agent/` convention. The exact value is opaque to the orchestrator — it only
 * needs to be stable and keyed by storyId.
 */
function stubWorktreePath(projectPath: string, storyId: string): string {
  return join(projectPath, '.cop1', 'worktrees', 'run', `${storyId}-wt`);
}

/**
 * In-memory synchronous WorktreePort spy. Mirrors the real adapter contract:
 * `create(projectPath, storyId) => string` and `cleanup(projectPath, worktreePath) => void`.
 */
function createWorktreeSpy(): WorktreePort & {
  createCalls: { projectPath: string; storyId: string }[];
  cleanupCalls: { projectPath: string; worktreePath: string }[];
} {
  const createCalls: { projectPath: string; storyId: string }[] = [];
  const cleanupCalls: { projectPath: string; worktreePath: string }[] = [];
  return {
    createCalls,
    cleanupCalls,
    create(projectPath: string, storyId: string): string {
      createCalls.push({ projectPath, storyId });
      return stubWorktreePath(projectPath, storyId);
    },
    cleanup(projectPath: string, worktreePath: string): void {
      cleanupCalls.push({ projectPath, worktreePath });
    },
    list(): string[] {
      return [];
    },
  };
}

describe('OrchestratorService — worktree isolation (ADR-018)', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'orchestrator-wt-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('creates one worktree per story keyed by storyKey', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const worktree = createWorktreeSpy();
    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' }));
    const svc = new OrchestratorService(runner, bus, undefined, undefined, undefined, worktree);

    await svc.run({
      playbook: singlePhasePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    expect(worktree.createCalls).toHaveLength(2);
    expect(worktree.createCalls.map((c) => c.storyId)).toEqual(['EA99-S1', 'EA99-S2']);
    expect(worktree.createCalls.every((c) => c.projectPath === projectRoot)).toBe(true);
  });

  it('runs the runner inside the worktree but persists status in the main tree', async () => {
    const statusPath = await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const worktree = createWorktreeSpy();
    const runnerProjectRoots: string[] = [];
    const runner: BMADCommandRunner = async (input) => {
      runnerProjectRoots.push(input.projectRoot);
      return { success: true, nextStatus: 'done' };
    };
    const svc = new OrchestratorService(runner, bus, undefined, undefined, undefined, worktree);

    await svc.run({
      playbook: singlePhasePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    // Runner ran inside the worktree path, never the main tree.
    expect(runnerProjectRoots).toEqual([
      stubWorktreePath(projectRoot, 'EA99-S1'),
      stubWorktreePath(projectRoot, 'EA99-S2'),
    ]);
    // Status persisted in the MAIN tree (not the worktree).
    const finalStatus = await readFile(statusPath, 'utf-8');
    expect(finalStatus).toContain('EA99-S1: done');
    expect(finalStatus).toContain('EA99-S2: done');
  });

  it('cleans up the worktree after a successful story', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const worktree = createWorktreeSpy();
    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' }));
    const svc = new OrchestratorService(runner, bus, undefined, undefined, undefined, worktree);

    await svc.run({
      playbook: singlePhasePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    expect(worktree.cleanupCalls.map((c) => c.worktreePath)).toEqual([
      stubWorktreePath(projectRoot, 'EA99-S1'),
      stubWorktreePath(projectRoot, 'EA99-S2'),
    ]);
    expect(worktree.cleanupCalls.every((c) => c.projectPath === projectRoot)).toBe(true);
  });

  it('keeps the worktree on a failed story and emits orchestrator.worktree.kept', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const kept: { storyKey?: string; worktreePath?: string }[] = [];
    bus.on('orchestrator.worktree.kept', (p) =>
      kept.push(p as { storyKey?: string; worktreePath?: string }),
    );
    const worktree = createWorktreeSpy();
    const runner = vi.fn(async ({ storyKey }) =>
      storyKey === 'EA99-S1'
        ? { success: false, note: 'dev failed' }
        : { success: true, nextStatus: 'done' },
    );
    const svc = new OrchestratorService(runner, bus, undefined, undefined, undefined, worktree);

    await svc.run({
      playbook: singlePhasePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    // S1 failed → kept (not cleaned). S2 succeeded → cleaned.
    expect(worktree.cleanupCalls.map((c) => c.worktreePath)).toEqual([
      stubWorktreePath(projectRoot, 'EA99-S2'),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.storyKey).toBe('EA99-S1');
    expect(kept[0]?.worktreePath).toBe(stubWorktreePath(projectRoot, 'EA99-S1'));
  });

  it('keeps the worktree on escalation abort and emits orchestrator.worktree.kept', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const kept: { storyKey?: string; worktreePath?: string }[] = [];
    bus.on('orchestrator.worktree.kept', (p) =>
      kept.push(p as { storyKey?: string; worktreePath?: string }),
    );
    const worktree = createWorktreeSpy();
    const runner = vi.fn(async () => ({
      success: true,
      escalated: true,
      nextStatus: 'in-review',
    }));
    const svc = new OrchestratorService(runner, bus, undefined, undefined, undefined, worktree);

    const result = await svc.run({
      playbook: singlePhasePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'abort-on-escalation',
    });

    expect(result.aborted).toBe(true);
    expect(worktree.cleanupCalls).toHaveLength(0);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.storyKey).toBe('EA99-S1');
  });

  it('blocks the story without crashing when worktree create throws', async () => {
    const statusPath = await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' }));
    const throwingWorktree: WorktreePort = {
      create() {
        throw new Error('git worktree add failed');
      },
      cleanup() {},
      list() {
        return [];
      },
    };
    const svc = new OrchestratorService(
      runner,
      bus,
      undefined,
      undefined,
      undefined,
      throwingWorktree,
    );

    const result = await svc.run({
      playbook: singlePhasePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    // Runner never invoked (story blocked before any command).
    expect(runner).not.toHaveBeenCalled();
    // Both stories reported blocked.
    expect(result.storiesProcessed.map((o) => o.nextStatus)).toEqual(['blocked', 'blocked']);
    const finalStatus = await readFile(statusPath, 'utf-8');
    expect(finalStatus).toContain('EA99-S1: blocked');
    expect(finalStatus).toContain('EA99-S2: blocked');
  });

  it('is a no-op (no worktree calls, status persisted) when no worktreePort is injected', async () => {
    const statusPath = await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const runnerProjectRoots: string[] = [];
    const runner: BMADCommandRunner = async (input) => {
      runnerProjectRoots.push(input.projectRoot);
      return { success: true, nextStatus: 'done' };
    };
    // No worktreePort — backward-compatible path.
    const svc = new OrchestratorService(runner, bus);

    await svc.run({
      playbook: singlePhasePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    // Runner ran against the main projectRoot, status persisted.
    expect(runnerProjectRoots.every((r) => r === projectRoot)).toBe(true);
    const finalStatus = await readFile(statusPath, 'utf-8');
    expect(finalStatus).toContain('EA99-S1: done');
  });
});
