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
import type { CommitAnchorPort } from '../../domain/CommitAnchor.js';
import type { WorkspaceInspectionPort } from '../../domain/WorkspaceChanges.js';
import { createDefaultBMADCommandRunner } from '../DefaultBMADCommandRunner.js';

function buildSupervisorService(projectRoot: string): SupervisorService {
  const eventBus = new EventBus();
  const sessionLogger = new SessionLogger(new StructuredLogger(projectRoot), eventBus);
  return new SupervisorService(new InMemorySupervisorAdapter(new Map()), sessionLogger);
}

class FakeSessionPort implements BMADSessionPort {
  constructor(private readonly firstTurn: SessionTurnResult) {}
  async startSession(_command: string, _context: BMADSessionContext): Promise<SessionHandle> {
    return { sessionId: 'sid-1', firstTurn: this.firstTurn };
  }
  async continueSession(_sessionId: string, _message: string): Promise<SessionTurnResult> {
    return { completed: true, output: 'ok', durationMs: 1 };
  }
}

class FakeInspector implements WorkspaceInspectionPort {
  calls = 0;
  constructor(private readonly sequence: string[][]) {}
  async changedPaths(): Promise<string[]> {
    const idx = Math.min(this.calls, this.sequence.length - 1);
    this.calls += 1;
    return this.sequence[idx] ?? [];
  }
}

class FakeCommitAnchor implements CommitAnchorPort {
  readonly calls: { root: string; message: string }[] = [];
  constructor(private readonly sha: string | null = 'sha123') {}
  async commit(root: string, message: string): Promise<string | null> {
    this.calls.push({ root, message });
    return this.sha;
  }
}

describe('DefaultBMADCommandRunner commit anchor', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'commit-anchor-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('commits the work after a verified dev-story success', async () => {
    const anchor = new FakeCommitAnchor('deadbee');
    const runner = createDefaultBMADCommandRunner({
      sessionPort: new FakeSessionPort({ completed: true, output: 'implemented', durationMs: 1 }),
      supervisorService: buildSupervisorService(dir),
      workspaceInspection: new FakeInspector([[], ['src/app.js']]),
      commitAnchor: anchor,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'FEAT-S1',
      epicId: 'FEAT',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    expect(anchor.calls).toHaveLength(1);
    expect(anchor.calls[0]?.root).toBe(dir);
    expect(anchor.calls[0]?.message).toContain('FEAT-S1');
  });

  it('does NOT commit for a non-code command (create-story)', async () => {
    const anchor = new FakeCommitAnchor();
    const runner = createDefaultBMADCommandRunner({
      sessionPort: new FakeSessionPort({ completed: true, output: 'story created', durationMs: 1 }),
      supervisorService: buildSupervisorService(dir),
      commitAnchor: anchor,
    });

    const result = await runner({
      command: '/bmad-bmm-create-story',
      storyKey: 'FEAT-S1',
      epicId: 'FEAT',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    expect(anchor.calls).toHaveLength(0);
  });
});
