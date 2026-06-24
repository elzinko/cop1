import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupervisorPlaybook } from '../../../features/orchestrator/domain/SupervisorPlaybook.js';
import { buildOrchestratorRun } from '../orchestrator.js';

const PLAYBOOK: SupervisorPlaybook = {
  version: '6.0.0',
  helpRef: '/bmad-help',
  phases: [{ name: 'Loop', commands: [{ command: '/bmad-bmm-dev-story' }] }],
  hooks: {},
};

async function seedStatus(dir: string): Promise<void> {
  const artifacts = join(dir, '_bmad-output', 'implementation-artifacts');
  await mkdir(artifacts, { recursive: true });
  await writeFile(
    join(artifacts, 'sprint-status.yaml'),
    ['development_status:', '  epic-ea99: in-progress', '  EA99-S1: ready-for-dev', ''].join('\n'),
  );
}

describe('buildOrchestratorRun', () => {
  let dir: string;
  let origExitCode: number | string | null | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'build-run-'));
    origExitCode = process.exitCode;
    process.exitCode = 0;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    process.exitCode = origExitCode;
  });

  it('runs the orchestrator emitting on the injected EventBus, without touching process.exitCode', async () => {
    await seedStatus(dir);
    const eventBus = new EventBus();
    const started: unknown[] = [];
    eventBus.on('orchestrator.run.started', (p) => started.push(p));
    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' as const }));

    const handle = await buildOrchestratorRun({
      playbook: PLAYBOOK,
      epic: 'EA99',
      mode: 'normal',
      projectRoot: dir,
      eventBus,
      runner,
    });
    const result = await handle.run();

    expect(runner).toHaveBeenCalled();
    expect(started).toHaveLength(1);
    expect(result.aborted).toBe(false);
    // The builder must not mutate process.exitCode (that is CLI-only).
    expect(process.exitCode).toBe(0);
  });

  it('honors caps.maxTokens by tripping the budget (run aborts)', async () => {
    await seedStatus(dir);
    const eventBus = new EventBus();
    // Runner reports enough tokens to exceed the cap on the first command, so the
    // budget trips before the next command and the run aborts.
    const runner = vi.fn(async () => {
      eventBus.emit('session.workflow.completed', { tokensUsed: 1000 });
      return { success: true, nextStatus: 'done' as const };
    });

    const handle = await buildOrchestratorRun({
      playbook: {
        version: '6.0.0',
        helpRef: '/bmad-help',
        phases: [{ name: 'Loop', commands: [{ command: '/a' }, { command: '/b' }] }],
        hooks: {},
      },
      epic: 'EA99',
      mode: 'normal',
      projectRoot: dir,
      eventBus,
      runner,
      caps: { maxTokens: 10 },
    });
    const result = await handle.run();

    expect(result.aborted).toBe(true);
  });
});
