import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StructuredLogger } from '@cop1/observability';
import { EventBus } from '@cop1/shared-kernel';
import {
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

function countingGate(result: VerificationResult): { gate: VerificationGate; calls: string[] } {
  const calls: string[] = [];
  const gate: VerificationGate = {
    async verify(input) {
      calls.push(input.command);
      return result;
    },
  };
  return { gate, calls };
}

function completedSession(): InMemorySessionAdapter {
  return new InMemorySessionAdapter([{ completed: true, output: 'done', durationMs: 1 }]);
}

describe('DefaultBMADCommandRunner verify gate', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'verify-gate-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('advances when the gate passes on dev-story', async () => {
    const { gate, calls } = countingGate({ passed: true, summary: 'ok' });
    const runner = createDefaultBMADCommandRunner({
      sessionPort: completedSession(),
      supervisorService: buildSupervisorService(dir),
      verificationGate: gate,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA1-S1',
      epicId: 'EA1',
      projectRoot: dir,
    });

    expect(calls).toEqual(['/bmad-bmm-dev-story']);
    expect(result.success).toBe(true);
    expect(result.nextStatus).toBe('in-review');
  });

  it('blocks (escalates, no nextStatus) when the gate fails on dev-story', async () => {
    const { gate } = countingGate({
      passed: false,
      summary: 'verify failed: pnpm -s test (exit 1)',
    });
    const runner = createDefaultBMADCommandRunner({
      sessionPort: completedSession(),
      supervisorService: buildSupervisorService(dir),
      verificationGate: gate,
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
    expect(result.note).toContain('verify failed');
  });

  it('skips the gate for non-code commands (create-story)', async () => {
    const { gate, calls } = countingGate({ passed: false, summary: 'should not run' });
    const runner = createDefaultBMADCommandRunner({
      sessionPort: completedSession(),
      supervisorService: buildSupervisorService(dir),
      verificationGate: gate,
    });

    const result = await runner({
      command: '/bmad-bmm-create-story',
      storyKey: 'EA1-S1',
      epicId: 'EA1',
      projectRoot: dir,
    });

    expect(calls).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.nextStatus).toBe('ready-for-dev');
  });

  it('is unchanged when no gate is injected (backward compatible)', async () => {
    const runner = createDefaultBMADCommandRunner({
      sessionPort: completedSession(),
      supervisorService: buildSupervisorService(dir),
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA1-S1',
      epicId: 'EA1',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    expect(result.nextStatus).toBe('in-review');
  });
});
