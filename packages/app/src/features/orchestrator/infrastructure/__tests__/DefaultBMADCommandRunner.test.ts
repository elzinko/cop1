import { EventBus } from '@cop1/shared-kernel';
import {
  InMemorySessionAdapter,
  InMemorySupervisorAdapter,
  SessionLogger,
  SupervisorService,
} from '@cop1/sprint-core';
import { StructuredLogger } from '@cop1/observability';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDefaultBMADCommandRunner,
  inferNextStatus,
} from '../DefaultBMADCommandRunner.js';

function buildSupervisorService(projectRoot: string): {
  supervisorService: SupervisorService;
  eventBus: EventBus;
} {
  const eventBus = new EventBus();
  const structuredLogger = new StructuredLogger(projectRoot);
  const sessionLogger = new SessionLogger(structuredLogger, eventBus);
  const supervisorAdapter = new InMemorySupervisorAdapter(new Map());
  const supervisorService = new SupervisorService(supervisorAdapter, sessionLogger);
  return { supervisorService, eventBus };
}

describe('DefaultBMADCommandRunner', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'default-runner-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('happy path — session completes on first turn, returns nextStatus derived from command', async () => {
    const { supervisorService } = buildSupervisorService(dir);
    const sessionPort = new InMemorySessionAdapter([
      { completed: true, output: 'ok', durationMs: 10 },
    ]);
    const runner = createDefaultBMADCommandRunner({ sessionPort, supervisorService });

    const result = await runner({
      command: '/bmad-bmm-create-story',
      storyKey: 'EA13-S1',
      epicId: 'EA13',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    expect(result.nextStatus).toBe('ready-for-dev');
    expect(result.note).toBe('ok');
  });

  it('maps dev-story → in-review', async () => {
    const { supervisorService } = buildSupervisorService(dir);
    const sessionPort = new InMemorySessionAdapter([
      { completed: true, output: 'done', durationMs: 10 },
    ]);
    const runner = createDefaultBMADCommandRunner({ sessionPort, supervisorService });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA13-S1',
      epicId: 'EA13',
      projectRoot: dir,
    });

    expect(result.nextStatus).toBe('in-review');
  });

  it('maps anything else → done', async () => {
    const { supervisorService } = buildSupervisorService(dir);
    const sessionPort = new InMemorySessionAdapter([
      { completed: true, output: 'done', durationMs: 10 },
    ]);
    const runner = createDefaultBMADCommandRunner({ sessionPort, supervisorService });

    const result = await runner({
      command: '/bmad-bmm-code-review',
      storyKey: 'EA13-S1',
      epicId: 'EA13',
      projectRoot: dir,
    });

    expect(result.nextStatus).toBe('done');
  });

  it('multi-turn path — drains follow-ups until completed', async () => {
    const { supervisorService } = buildSupervisorService(dir);
    const sessionPort = new InMemorySessionAdapter([
      { completed: false, output: 'turn 1', durationMs: 10 },
      { completed: false, output: 'turn 2', durationMs: 10 },
      { completed: true, output: 'turn 3', durationMs: 10 },
    ]);
    const runner = createDefaultBMADCommandRunner({ sessionPort, supervisorService });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA13-S1',
      epicId: 'EA13',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    expect(result.note).toContain('turn 1');
    expect(result.note).toContain('turn 2');
    expect(result.note).toContain('turn 3');
  });

  it('error path — first turn error produces escalated=true', async () => {
    const { supervisorService } = buildSupervisorService(dir);
    const sessionPort = new InMemorySessionAdapter([
      {
        completed: false,
        output: '',
        error: true,
        errorMessage: 'boom',
        durationMs: 1,
      },
    ]);
    const runner = createDefaultBMADCommandRunner({ sessionPort, supervisorService });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA13-S1',
      epicId: 'EA13',
      projectRoot: dir,
    });

    expect(result.success).toBe(false);
    expect(result.escalated).toBe(true);
    expect(result.note).toBe('boom');
  });

  it('timeout path — session never completes within follow-up budget', async () => {
    const { supervisorService } = buildSupervisorService(dir);
    const sessionPort = new InMemorySessionAdapter([
      { completed: false, output: 't0', durationMs: 1 },
      { completed: false, output: 't1', durationMs: 1 },
      { completed: false, output: 't2', durationMs: 1 },
      { completed: false, output: 't3', durationMs: 1 },
    ]);
    const runner = createDefaultBMADCommandRunner({ sessionPort, supervisorService });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA13-S1',
      epicId: 'EA13',
      projectRoot: dir,
    });

    expect(result.success).toBe(false);
    expect(result.escalated).toBe(true);
    expect(result.note).toBe('session did not complete within follow-up budget');
  });

  it('startSession failure surfaces as escalated', async () => {
    const { supervisorService } = buildSupervisorService(dir);
    const sessionPort: Parameters<typeof createDefaultBMADCommandRunner>[0]['sessionPort'] = {
      async startSession() {
        throw new Error('adapter down');
      },
      async continueSession() {
        throw new Error('should not be called');
      },
    };
    const runner = createDefaultBMADCommandRunner({ sessionPort, supervisorService });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA13-S1',
      epicId: 'EA13',
      projectRoot: dir,
    });

    expect(result.success).toBe(false);
    expect(result.escalated).toBe(true);
    expect(result.note).toBe('adapter down');
  });
});

describe('inferNextStatus', () => {
  it('maps create-story → ready-for-dev', () => {
    expect(inferNextStatus('/bmad-bmm-create-story')).toBe('ready-for-dev');
  });
  it('maps dev-story → in-review', () => {
    expect(inferNextStatus('/bmad-bmm-dev-story')).toBe('in-review');
  });
  it('maps unknown commands → done', () => {
    expect(inferNextStatus('/bmad-bmm-code-review')).toBe('done');
    expect(inferNextStatus('/bmad-bmm-qa-automate')).toBe('done');
    expect(inferNextStatus('/anything-else')).toBe('done');
  });
});
