import { EventBus } from '@cop1/shared-kernel';
import {
  ExchangeHistoryWriter,
  InMemorySessionAdapter,
  InMemorySupervisorAdapter,
  SessionInteractionCollector,
  SessionLogger,
  SupervisorService,
} from '@cop1/sprint-core';
import { StructuredLogger } from '@cop1/observability';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
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

describe('EA14-S2 — ExchangeHistoryWriter integration', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'exchange-writer-runner-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function buildCollectingSupervisorService(projectRoot: string) {
    const eventBus = new EventBus();
    const structuredLogger = new StructuredLogger(projectRoot);
    const interactionCollector = new SessionInteractionCollector(structuredLogger, eventBus);
    const supervisorAdapter = new InMemorySupervisorAdapter(new Map());
    const supervisorService = new SupervisorService(supervisorAdapter, interactionCollector);
    return { supervisorService, interactionCollector, eventBus };
  }

  it('creates .cop1/history/ directory with Track 2 markdown after successful session', async () => {
    const { supervisorService, interactionCollector } = buildCollectingSupervisorService(dir);
    const exchangeHistoryWriter = new ExchangeHistoryWriter(dir);
    const sessionPort = new InMemorySessionAdapter([
      { completed: true, output: 'done', durationMs: 10 },
    ]);
    const runner = createDefaultBMADCommandRunner({
      sessionPort,
      supervisorService,
      exchangeHistoryWriter,
      interactionCollector,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA14-S2',
      epicId: 'EA14',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);

    // Verify .cop1/history/ directory was created with Track 2 content.
    const historyDir = join(dir, '.cop1', 'history', 'EA14', 'EA14-S2');
    expect(existsSync(historyDir)).toBe(true);
    const files = await readdir(historyDir);
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files[0]).toMatch(/\.md$/);
  });

  it('writes Track 2 markdown even on failed session', async () => {
    const { supervisorService, interactionCollector } = buildCollectingSupervisorService(dir);
    const exchangeHistoryWriter = new ExchangeHistoryWriter(dir);
    const sessionPort = new InMemorySessionAdapter([
      { completed: false, output: '', error: true, errorMessage: 'boom', durationMs: 1 },
    ]);
    const runner = createDefaultBMADCommandRunner({
      sessionPort,
      supervisorService,
      exchangeHistoryWriter,
      interactionCollector,
    });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA14-S2',
      epicId: 'EA14',
      projectRoot: dir,
    });

    expect(result.success).toBe(false);

    // Track 2 file should still be written for failed sessions.
    const historyDir = join(dir, '.cop1', 'history', 'EA14', 'EA14-S2');
    expect(existsSync(historyDir)).toBe(true);
  });

  it('works without writer (backwards compatible)', async () => {
    const { supervisorService } = buildSupervisorService(dir);
    const sessionPort = new InMemorySessionAdapter([
      { completed: true, output: 'ok', durationMs: 10 },
    ]);
    const runner = createDefaultBMADCommandRunner({ sessionPort, supervisorService });

    const result = await runner({
      command: '/bmad-bmm-dev-story',
      storyKey: 'EA14-S2',
      epicId: 'EA14',
      projectRoot: dir,
    });

    expect(result.success).toBe(true);
    // No .cop1/history/ should be created when writer is not provided.
    expect(existsSync(join(dir, '.cop1', 'history'))).toBe(false);
  });
});

describe('orchestrator CLI --runner stub guard (EA13-S2 adversarial fix)', () => {
  let origEnv: string | undefined;

  beforeEach(() => {
    origEnv = process.env.COP1_ALLOW_STUB_RUNNER;
    delete process.env.COP1_ALLOW_STUB_RUNNER;
  });
  afterEach(() => {
    if (origEnv === undefined) delete process.env.COP1_ALLOW_STUB_RUNNER;
    else process.env.COP1_ALLOW_STUB_RUNNER = origEnv;
  });

  it('--runner stub without COP1_ALLOW_STUB_RUNNER throws', async () => {
    const { orchestratorRunCommand } = await import('../../../../cli/commands/orchestrator.js');
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const projectRoot = await mkdtemp(join(tmpdir(), 'stub-guard-'));
    await writeFile(join(projectRoot, 'supervisor-playbook.md'), '## Mission\ntest\n');
    await mkdir(join(projectRoot, '_bmad-output', 'implementation-artifacts'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
      'development_status:\n  epic-x: in-progress\n  X-S1: ready-for-dev\n',
    );

    const origExitCode = process.exitCode;
    process.exitCode = 0;
    try {
      await orchestratorRunCommand({ epic: 'X', projectRoot, runner: 'stub' });
      // The CLI catches the throw and maps it to exit code 2 (runtime error).
      expect(process.exitCode).toBe(2);
    } finally {
      process.exitCode = origExitCode;
    }
  });

  it('--runner stub with COP1_ALLOW_STUB_RUNNER=1 succeeds', async () => {
    process.env.COP1_ALLOW_STUB_RUNNER = '1';
    const { orchestratorRunCommand } = await import('../../../../cli/commands/orchestrator.js');
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const projectRoot = await mkdtemp(join(tmpdir(), 'stub-guard-ok-'));
    await writeFile(join(projectRoot, 'supervisor-playbook.md'), '## Mission\ntest\n');
    await mkdir(join(projectRoot, '_bmad-output', 'implementation-artifacts'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
      'development_status:\n  epic-x: in-progress\n  X-S1: ready-for-dev\n',
    );

    const origExitCode = process.exitCode;
    process.exitCode = 0;
    try {
      await orchestratorRunCommand({ epic: 'X', projectRoot, runner: 'stub' });
      expect(process.exitCode).toBe(0);
    } finally {
      process.exitCode = origExitCode;
    }
  });
});
