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

function runReview(dir: string, output: string) {
  const runner = createDefaultBMADCommandRunner({
    sessionPort: new FakeSessionPort({ completed: true, output, durationMs: 1 }),
    supervisorService: buildSupervisorService(dir),
  });
  return runner({
    command: '/bmad-bmm-code-review',
    storyKey: 'FEAT-S1',
    epicId: 'FEAT',
    projectRoot: dir,
  });
}

describe('DefaultBMADCommandRunner review-verdict gate', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'review-verdict-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('blocks a code-review that explicitly requests changes (does not advance to done)', async () => {
    const result = await runReview(
      dir,
      'Verdict: FAIL — several acceptance criteria are not implemented. Changes requested.',
    );
    expect(result.success).toBe(false);
    expect(result.escalated).toBe(true);
    expect(result.nextStatus).toBeUndefined();
    expect(result.note).toContain('requested changes');
  });

  it('advances a code-review with an approving verdict to done', async () => {
    const result = await runReview(dir, 'Verdict: PASS ✅ — all acceptance criteria met. LGTM.');
    expect(result.success).toBe(true);
    expect(result.nextStatus).toBe('done');
  });

  it('advances on an ambiguous review (unknown verdict never over-blocks)', async () => {
    const result = await runReview(
      dir,
      'I reviewed the implementation against the story; tests pass and there are no blockers.',
    );
    expect(result.success).toBe(true);
    expect(result.nextStatus).toBe('done');
  });
});
