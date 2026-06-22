import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StructuredLogger } from '@cop1/observability';
import { EventBus } from '@cop1/shared-kernel';
import {
  type BMADSessionContext,
  type BMADSessionPort,
  InMemorySupervisorAdapter,
  type SessionHandle,
  SessionLogger,
  type SessionTurnResult,
  SupervisorService,
} from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspaceInspectionPort } from '../../domain/WorkspaceChanges.js';
import { createDefaultBMADCommandRunner } from '../DefaultBMADCommandRunner.js';

function buildSupervisorService(projectRoot: string): SupervisorService {
  const eventBus = new EventBus();
  const sessionLogger = new SessionLogger(new StructuredLogger(projectRoot), eventBus);
  return new SupervisorService(new InMemorySupervisorAdapter(new Map()), sessionLogger);
}

/** Session port that completes the first turn, then replays scripted continuations. */
class FakeSessionPort implements BMADSessionPort {
  readonly continueCalls: string[] = [];
  constructor(
    private readonly firstTurn: SessionTurnResult,
    private readonly continuations: SessionTurnResult[] = [],
  ) {}
  async startSession(_command: string, _context: BMADSessionContext): Promise<SessionHandle> {
    return { sessionId: 'sid-1', firstTurn: this.firstTurn };
  }
  async continueSession(_sessionId: string, message: string): Promise<SessionTurnResult> {
    this.continueCalls.push(message);
    return this.continuations.shift() ?? { completed: true, output: 'ok', durationMs: 1 };
  }
}

/** Inspector replaying a scripted sequence of changed-path snapshots. */
class FakeInspector implements WorkspaceInspectionPort {
  calls = 0;
  constructor(private readonly sequence: string[][]) {}
  async changedPaths(): Promise<string[]> {
    const idx = Math.min(this.calls, this.sequence.length - 1);
    this.calls += 1;
    return this.sequence[idx] ?? [];
  }
}

const PLANNED_ONLY: SessionTurnResult = {
  completed: true,
  output: 'Here is my plan: edit src/index.html, src/style.css, src/app.js',
  durationMs: 1,
};

describe('DefaultBMADCommandRunner evidence gate', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'evidence-gate-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('blocks dev-story that never writes code (only bookkeeping changes)', async () => {
    const port = new FakeSessionPort(PLANNED_ONLY);
    const inspector = new FakeInspector([['_bmad-output/implementation-artifacts/FEAT-S1.md']]);
    const runner = createDefaultBMADCommandRunner({
      sessionPort: port,
      supervisorService: buildSupervisorService(dir),
      workspaceInspection: inspector,
      maxImplementationRetries: 2,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'FEAT-S1',
      epicId: 'FEAT',
      projectRoot: dir,
    });

    expect(result.success).toBe(false);
    expect(result.escalated).toBe(true);
    expect(result.nextStatus).toBeUndefined();
    expect(result.note).toContain('no source changes');
    // Two corrective "implement now" continuations were attempted.
    expect(port.continueCalls).toHaveLength(2);
    expect(port.continueCalls[0]).toContain('Implement');
  });

  it('drives a corrective continuation and succeeds once code appears', async () => {
    const port = new FakeSessionPort(PLANNED_ONLY, [
      { completed: true, output: 'done implementing', durationMs: 1 },
    ]);
    // 1st snapshot (pre-loop): no code. 2nd snapshot (after 1 continuation): code present.
    const inspector = new FakeInspector([
      ['_bmad-output/implementation-artifacts/FEAT-S1.md'],
      ['_bmad-output/implementation-artifacts/FEAT-S1.md', 'src/app.js'],
    ]);
    const runner = createDefaultBMADCommandRunner({
      sessionPort: port,
      supervisorService: buildSupervisorService(dir),
      workspaceInspection: inspector,
      maxImplementationRetries: 2,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'FEAT-S1',
      epicId: 'FEAT',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    expect(result.nextStatus).toBe('in-review');
    expect(port.continueCalls).toHaveLength(1);
  });

  it('advances dev-story that wrote code on the first turn (no corrective continuation)', async () => {
    const port = new FakeSessionPort({ completed: true, output: 'implemented', durationMs: 1 });
    const inspector = new FakeInspector([['src/app.js', 'src/style.css']]);
    const runner = createDefaultBMADCommandRunner({
      sessionPort: port,
      supervisorService: buildSupervisorService(dir),
      workspaceInspection: inspector,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'FEAT-S1',
      epicId: 'FEAT',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    expect(result.nextStatus).toBe('in-review');
    expect(port.continueCalls).toHaveLength(0);
  });

  it('does not inspect the workspace for non-code commands (create-story)', async () => {
    const port = new FakeSessionPort({ completed: true, output: 'story created', durationMs: 1 });
    const inspector = new FakeInspector([[]]);
    const runner = createDefaultBMADCommandRunner({
      sessionPort: port,
      supervisorService: buildSupervisorService(dir),
      workspaceInspection: inspector,
    });

    const result = await runner({
      command: '/bmad-bmm-create-story',
      storyKey: 'FEAT-S1',
      epicId: 'FEAT',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    expect(result.nextStatus).toBe('ready-for-dev');
    expect(inspector.calls).toBe(0);
  });
});
