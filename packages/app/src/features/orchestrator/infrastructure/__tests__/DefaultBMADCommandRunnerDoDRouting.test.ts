import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StructuredLogger } from '@cop1/observability';
import { EventBus } from '@cop1/shared-kernel';
import {
  type DoDCheckRegistry,
  type DoDContext,
  type DoDEvaluation,
  DoDService,
  InMemorySessionAdapter,
  InMemorySupervisorAdapter,
  SessionLogger,
  SupervisorService,
} from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { VerificationGate, VerificationResult } from '../../domain/VerificationGate.js';
import { createDefaultBMADCommandRunner } from '../DefaultBMADCommandRunner.js';

function buildSupervisorService(projectRoot: string): SupervisorService {
  const eventBus = new EventBus();
  const sessionLogger = new SessionLogger(new StructuredLogger(projectRoot), eventBus);
  return new SupervisorService(new InMemorySupervisorAdapter(new Map()), sessionLogger);
}

function completedSession(output = 'done'): InMemorySessionAdapter {
  return new InMemorySessionAdapter([{ completed: true, output, durationMs: 1 }]);
}

/** A DoDService stub whose `evaluate` returns a fixed verdict, recording calls. */
class StubDoDService extends DoDService {
  readonly calls: { criteria: string[]; ctx: DoDContext }[] = [];
  constructor(private readonly verdict: DoDEvaluation) {
    super();
  }
  override async evaluate(
    ctx: DoDContext,
    criteria: string[],
    _registry: DoDCheckRegistry,
  ): Promise<DoDEvaluation> {
    this.calls.push({ criteria, ctx });
    return this.verdict;
  }
}

/** A VerificationGate that records whether it was consulted directly. */
function spyGate(result: VerificationResult): { gate: VerificationGate; calls: string[] } {
  const calls: string[] = [];
  return {
    gate: {
      async verify(input) {
        calls.push(input.command);
        return result;
      },
    },
    calls,
  };
}

describe('DefaultBMADCommandRunner DoD routing (registry is the path)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dod-routing-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('blocks the story when the injected DoDService.evaluate fails', async () => {
    const dodService = new StubDoDService({
      passed: false,
      failures: [{ id: 'verification', detail: 'verify failed: injected' }],
    });
    const runner = createDefaultBMADCommandRunner({
      sessionPort: completedSession(),
      supervisorService: buildSupervisorService(dir),
      dodService,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA1-S1',
      epicId: 'EA1',
      projectRoot: dir,
    });

    expect(result.success).toBe(false);
    expect(result.escalated).toBe(true);
    expect(result.nextStatus).toBeUndefined();
    expect(result.note).toBe('verify failed: injected');
    expect(dodService.calls).toHaveLength(1);
    expect(dodService.calls[0]?.criteria).toEqual(['verification', 'review_verdict']);
  });

  it('routes the transition decision THROUGH evaluate — the verification gate is not consulted directly', async () => {
    // DoDService says pass; a real VerificationGate would FAIL. If the runner
    // still advances, the transition decision came from evaluate, not the gate.
    const dodService = new StubDoDService({ passed: true, failures: [] });
    const { gate, calls } = spyGate({ passed: false, summary: 'gate would have failed' });
    const runner = createDefaultBMADCommandRunner({
      sessionPort: completedSession(),
      supervisorService: buildSupervisorService(dir),
      verificationGate: gate,
      dodService,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA1-S1',
      epicId: 'EA1',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    expect(result.nextStatus).toBe('in-review');
    // The gate is never consulted by the runner directly for the decision.
    expect(calls).toEqual([]);
    expect(dodService.calls).toHaveLength(1);
  });

  it('passes the joined agent output into the DoD context', async () => {
    const dodService = new StubDoDService({ passed: true, failures: [] });
    const runner = createDefaultBMADCommandRunner({
      sessionPort: completedSession('review prose here'),
      supervisorService: buildSupervisorService(dir),
      dodService,
    });

    await runner({
      command: '/bmad-bmm-code-review',
      storyKey: 'FEAT-S1',
      epicId: 'FEAT',
      projectRoot: dir,
    });

    expect(dodService.calls[0]?.ctx.agentOutput).toBe('review prose here');
    expect(dodService.calls[0]?.ctx.command).toBe('/bmad-bmm-code-review');
    expect(dodService.calls[0]?.ctx.storyKey).toBe('FEAT-S1');
  });
});
