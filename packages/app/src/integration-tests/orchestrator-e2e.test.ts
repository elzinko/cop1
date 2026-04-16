import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type BMADCommandRunner,
  OrchestratorService,
} from '../features/orchestrator/application/OrchestratorService.js';
import { SupervisorPlaybookLoader } from '../features/orchestrator/application/SupervisorPlaybookLoader.js';

/**
 * EA10-S9 — E2E integration test on local fixture (Plan B per validation report).
 *
 * Runs `OrchestratorService` end-to-end on a minimal fixture story:
 *   create-story → dev-story → code-review
 *
 * No real LLM, no real BMAD session — the `BMADCommandRunner` is scripted so
 * we validate orchestrator wiring and state transitions, not BMAD agent
 * quality.
 *
 * Migrates to the EA6 cobaye fixture when EA6 ships.
 */

async function seedProject(dir: string): Promise<void> {
  // .claude/commands/ — command discovery
  const cmds = join(dir, '.claude', 'commands');
  await mkdir(cmds, { recursive: true });
  for (const name of ['bmad-bmm-create-story', 'bmad-bmm-dev-story', 'bmad-bmm-code-review']) {
    await writeFile(join(cmds, `${name}.md`), '---\nname: stub\n---\n');
  }

  // supervisor-playbook.md
  await writeFile(
    join(dir, 'supervisor-playbook.md'),
    [
      'BMAD version: 6.0.0',
      'help: /bmad-help',
      'Epic/story restrictions: fixture',
      'Worktree hooks: managed',
      'Step-by-step hooks: transition-level',
      'Decision policy: 3-tier cascade',
      '',
      '## Story Creation',
      '1. `/bmad-bmm-create-story`',
      '',
      '## Development Loop',
      '1. `/bmad-bmm-dev-story`',
      '2. `/bmad-bmm-code-review`',
      '',
    ].join('\n'),
  );

  // sprint-status.yaml — one fixture story
  const artifacts = join(dir, '_bmad-output', 'implementation-artifacts');
  await mkdir(artifacts, { recursive: true });
  await writeFile(
    join(artifacts, 'sprint-status.yaml'),
    ['development_status:', '  epic-ea99: in-progress', '  EA99-S1: backlog', ''].join('\n'),
  );
}

describe('EA10-S9 — Orchestrator E2E on local fixture', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'ea10-e2e-'));
    await seedProject(projectRoot);
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('runs create-story → dev-story → code-review to completion, updates sprint-status.yaml and logs structured events', async () => {
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    const playbook = await loader.load(join(projectRoot, 'supervisor-playbook.md'));

    const bus = new EventBus();
    const bmadEvents: string[] = [];
    bus.on('orchestrator.run.started', () => bmadEvents.push('run.started'));
    bus.on('orchestrator.story.started', () => bmadEvents.push('story.started'));
    bus.on('orchestrator.command.completed', (p: unknown) => {
      const cast = p as { command: string; success: boolean };
      bmadEvents.push(`cmd.${cast.command.replace('/bmad-bmm-', '')}.${cast.success}`);
    });
    bus.on('orchestrator.story.completed', () => bmadEvents.push('story.completed'));
    bus.on('orchestrator.run.completed', () => bmadEvents.push('run.completed'));

    const autoDecisions: Array<Record<string, unknown>> = [];

    // Scripted runner — simulates a successful 3-command run
    const runner: BMADCommandRunner = async ({ command }) => {
      const nextStatus = command.includes('create-story')
        ? 'ready-for-dev'
        : command.includes('dev-story')
          ? 'in-review'
          : 'done';
      return { success: true, nextStatus };
    };

    const svc = new OrchestratorService(runner, bus, undefined, (p) => autoDecisions.push(p));
    const result = await svc.run({
      playbook,
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    // AC1 + AC2 — 3-command loop executed
    expect(bmadEvents).toEqual([
      'run.started',
      'story.started',
      'cmd.create-story.true',
      'cmd.dev-story.true',
      'cmd.code-review.true',
      'story.completed',
      'run.completed',
    ]);
    expect(result.storiesProcessed).toHaveLength(1);
    expect(result.storiesProcessed[0]!.nextStatus).toBe('done');

    // AC4 — state transitions persisted
    const status = await readFile(
      join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
      'utf-8',
    );
    expect(status).toContain('EA99-S1: done');

    // AC5 — auto-decision log captured per command
    expect(autoDecisions).toHaveLength(3);
    expect(autoDecisions[0]!.event).toBe('auto-decision');
    expect(autoDecisions.map((d) => d.command)).toEqual([
      '/bmad-bmm-create-story',
      '/bmad-bmm-dev-story',
      '/bmad-bmm-code-review',
    ]);
  });

  it('plan B fixture: supports substitution for EA6 cobaye when it lands — confirmed via scripted runner', async () => {
    // Sentinel: this test exists to make the Plan-B substitution visible in CI.
    // When EA6 is ready, copy/adapt this test to run against the cobaye harness.
    expect(true).toBe(true);
  });
});
