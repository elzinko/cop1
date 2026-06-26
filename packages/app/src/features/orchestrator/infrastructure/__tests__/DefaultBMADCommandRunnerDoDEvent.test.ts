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
import { createDefaultBMADCommandRunner } from '../DefaultBMADCommandRunner.js';

function buildSupervisorService(projectRoot: string): SupervisorService {
  const eventBus = new EventBus();
  const sessionLogger = new SessionLogger(new StructuredLogger(projectRoot), eventBus);
  return new SupervisorService(new InMemorySupervisorAdapter(new Map()), sessionLogger);
}

function completedSession(output = 'done'): InMemorySessionAdapter {
  return new InMemorySessionAdapter([{ completed: true, output, durationMs: 1 }]);
}

/** A DoDService stub whose `evaluate` returns a fixed verdict. */
class StubDoDService extends DoDService {
  constructor(private readonly verdict: DoDEvaluation) {
    super();
  }
  override async evaluate(
    _ctx: DoDContext,
    _criteria: string[],
    _registry: DoDCheckRegistry,
  ): Promise<DoDEvaluation> {
    return this.verdict;
  }
}

/** An EventBus that records every emit, for assertions. */
class SpyEventBus extends EventBus {
  readonly emitted: { eventType: string; payload: unknown }[] = [];
  override emit(eventType: string, payload: unknown): void {
    this.emitted.push({ eventType, payload });
    super.emit(eventType, payload);
  }
}

describe('DefaultBMADCommandRunner — dod.check.failed event (ADR-020 / fiche 0016)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dod-event-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('emits dod.check.failed once with {storyKey, command, failures} when the DoD gate rejects', async () => {
    const eventBus = new SpyEventBus();
    const failures = [{ id: 'verification', detail: 'verify failed: X' }];
    const runner = createDefaultBMADCommandRunner({
      sessionPort: completedSession(),
      supervisorService: buildSupervisorService(dir),
      dodService: new StubDoDService({ passed: false, failures }),
      eventBus,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA1-S1',
      epicId: 'EA1',
      projectRoot: dir,
    });

    expect(result.success).toBe(false);
    const dodEvents = eventBus.emitted.filter((e) => e.eventType === 'dod.check.failed');
    expect(dodEvents).toHaveLength(1);
    const payload = dodEvents[0]?.payload as {
      storyKey: string;
      command: string;
      failures: { id: string; detail?: string }[];
      runId?: string;
      ts?: string;
    };
    expect(payload.storyKey).toBe('EA1-S1');
    expect(payload.command).toBe('/bmad-bmm-dev-story');
    expect(payload.failures).toEqual(failures);
    // runId is injected downstream by the run's TaggingEventBus, not here.
    expect(payload.runId).toBeUndefined();
  });

  it('does NOT emit dod.check.failed when the DoD gate passes', async () => {
    const eventBus = new SpyEventBus();
    const runner = createDefaultBMADCommandRunner({
      sessionPort: completedSession(),
      supervisorService: buildSupervisorService(dir),
      dodService: new StubDoDService({ passed: true, failures: [] }),
      eventBus,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA1-S1',
      epicId: 'EA1',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    expect(eventBus.emitted.filter((e) => e.eventType === 'dod.check.failed')).toHaveLength(0);
  });

  it('still returns the same failure result when no eventBus is injected (no crash)', async () => {
    const runner = createDefaultBMADCommandRunner({
      sessionPort: completedSession(),
      supervisorService: buildSupervisorService(dir),
      dodService: new StubDoDService({
        passed: false,
        failures: [{ id: 'verification', detail: 'verify failed: X' }],
      }),
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA1-S1',
      epicId: 'EA1',
      projectRoot: dir,
    });

    expect(result.success).toBe(false);
    expect(result.escalated).toBe(true);
    expect(result.note).toBe('verify failed: X');
  });
});
