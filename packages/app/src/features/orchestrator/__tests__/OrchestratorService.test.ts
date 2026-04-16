import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OrchestratorService,
  extractStoryKeysForEpic,
  rewriteStoryStatus,
} from '../application/OrchestratorService.js';
import type { BMADCommandRunner } from '../application/OrchestratorService.js';
import type { SupervisorPlaybook } from '../domain/SupervisorPlaybook.js';

function samplePlaybook(): SupervisorPlaybook {
  return {
    version: '6.0.0',
    helpRef: '/bmad-help',
    phases: [
      {
        name: 'Story Creation',
        commands: [{ command: '/bmad-bmm-create-story' }],
      },
      {
        name: 'Development Loop',
        commands: [{ command: '/bmad-bmm-dev-story' }, { command: '/bmad-bmm-code-review' }],
      },
    ],
    hooks: {},
  };
}

async function seedStatusFile(dir: string): Promise<string> {
  const artifactsDir = join(dir, '_bmad-output', 'implementation-artifacts');
  await mkdir(artifactsDir, { recursive: true });
  const path = join(artifactsDir, 'sprint-status.yaml');
  await writeFile(
    path,
    [
      'development_status:',
      '  epic-ea99: in-progress',
      '  EA99-S1: ready-for-dev   # first',
      '  EA99-S2: ready-for-dev   # second',
      '  EA99-S3: done            # already closed',
      '  E1-S1: backlog           # other epic, should be ignored',
      '',
    ].join('\n'),
  );
  return path;
}

describe('OrchestratorService', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'orchestrator-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('processes each non-done story of the target epic in order', async () => {
    const statusPath = await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const runner = vi.fn(async ({ command }) => ({
      success: true,
      nextStatus: command.includes('create-story')
        ? 'ready-for-dev'
        : command.includes('dev-story')
          ? 'in-review'
          : 'done',
    }));
    const svc = new OrchestratorService(runner, bus);

    const result = await svc.run({
      playbook: samplePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    expect(result.storiesProcessed.map((o) => o.storyKey)).toEqual(['EA99-S1', 'EA99-S2']);
    expect(runner).toHaveBeenCalledTimes(6); // 2 stories × 3 commands
    const finalStatus = await readFile(statusPath, 'utf-8');
    expect(finalStatus).toContain('EA99-S1: done');
    expect(finalStatus).toContain('EA99-S2: done');
    expect(finalStatus).toContain('EA99-S3: done');
    expect(result.escalated).toBe(false);
    expect(result.aborted).toBe(false);
  });

  it('marks story blocked on runner failure and moves to next story', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const calls: string[] = [];
    const runner = vi.fn(async ({ storyKey, command }) => {
      calls.push(`${storyKey}:${command}`);
      if (storyKey === 'EA99-S1' && command.includes('dev-story')) {
        return { success: false, note: 'dev failed' };
      }
      return {
        success: true,
        nextStatus: command.includes('create-story')
          ? 'ready-for-dev'
          : command.includes('dev-story')
            ? 'in-review'
            : 'done',
      };
    });
    const svc = new OrchestratorService(runner, bus);

    const result = await svc.run({
      playbook: samplePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    const s1 = result.storiesProcessed.find((o) => o.storyKey === 'EA99-S1');
    expect(s1?.nextStatus).toBe('blocked');
    expect(s1?.error).toBe('dev failed');
    // S2 still processed
    expect(result.storiesProcessed.map((o) => o.storyKey)).toContain('EA99-S2');
  });

  it('aborts on escalation when mode=abort-on-escalation', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const runner = vi.fn(async ({ command }) => ({
      success: true,
      escalated: command.includes('dev-story'),
      nextStatus: 'in-review',
    }));
    const svc = new OrchestratorService(runner, bus);

    const result = await svc.run({
      playbook: samplePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'abort-on-escalation',
    });

    expect(result.escalated).toBe(true);
    expect(result.aborted).toBe(true);
    expect(result.storiesProcessed).toHaveLength(1); // stopped after first story
  });

  it('step-by-step gate abort halts orchestrator', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' }));
    const gate = vi.fn(async () => 'abort' as const);
    const svc = new OrchestratorService(runner, bus, gate);

    const result = await svc.run({
      playbook: samplePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'step-by-step',
    });

    expect(result.aborted).toBe(true);
    expect(runner).not.toHaveBeenCalled();
  });

  it('emits EventBus lifecycle events', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const events: string[] = [];
    bus.on('orchestrator.run.started', () => events.push('run.started'));
    bus.on('orchestrator.story.started', () => events.push('story.started'));
    bus.on('orchestrator.command.started', () => events.push('command.started'));
    bus.on('orchestrator.command.completed', () => events.push('command.completed'));
    bus.on('orchestrator.story.completed', () => events.push('story.completed'));
    bus.on('orchestrator.run.completed', () => events.push('run.completed'));

    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' }));
    const svc = new OrchestratorService(runner, bus);
    await svc.run({
      playbook: { ...samplePlaybook(), phases: [samplePlaybook().phases[0]!] }, // single phase
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    expect(events[0]).toBe('run.started');
    expect(events[events.length - 1]).toBe('run.completed');
    expect(events.filter((e) => e === 'story.started').length).toBeGreaterThan(0);
  });

  it('falls back to DEFAULT_ORCHESTRATOR_CYCLE when phase has no commands (EA12-S3)', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const commandsInvoked: string[] = [];
    const runner: BMADCommandRunner = async (input) => {
      commandsInvoked.push(input.command);
      return { success: true, nextStatus: 'done' };
    };
    const svc = new OrchestratorService(runner, bus);

    // Prose-only playbook — phases have names but no commands.
    const intentOnly: SupervisorPlaybook = {
      version: '6.0.0',
      helpRef: '/bmad-help',
      phases: [
        { name: 'Story Creation', intent: 'prose only' },
        { name: 'Development Loop', intent: 'prose only' },
      ],
      hooks: {},
    };

    await svc.run({
      playbook: intentOnly,
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    // Canonical cycle from sprint-core:
    //   Story Creation → /bmad-bmm-create-story
    //   Development Loop → /bmad-bmm-dev-story, /bmad-bmm-code-review
    expect(commandsInvoked).toContain('/bmad-bmm-create-story');
    expect(commandsInvoked).toContain('/bmad-bmm-dev-story');
    expect(commandsInvoked).toContain('/bmad-bmm-code-review');
  });

  it('skips phases whose name is unknown to DEFAULT_ORCHESTRATOR_CYCLE and which have no commands', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' }));
    const svc = new OrchestratorService(runner, bus);

    const noopPlaybook: SupervisorPlaybook = {
      version: '6.0.0',
      helpRef: '/bmad-help',
      phases: [{ name: 'Unknown Phase', intent: 'nothing to do' }],
      hooks: {},
    };

    await svc.run({
      playbook: noopPlaybook,
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    expect(runner).not.toHaveBeenCalled();
  });

  it('calls auto-decision logger per command', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const logger = vi.fn();
    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' }));
    const svc = new OrchestratorService(runner, bus, undefined, logger);

    await svc.run({
      playbook: samplePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });
    expect(logger).toHaveBeenCalled();
    expect(logger.mock.calls[0]![0]).toMatchObject({ event: 'auto-decision' });
  });
});

describe('OrchestratorService YAML helpers', () => {
  it('extractStoryKeysForEpic filters to the target epic', () => {
    const yaml = [
      'development_status:',
      '  epic-ea11: done',
      '  EA11-S1: done',
      '  EA11-S2: done',
      '  EA10-S1: ready-for-dev',
      '  E1-S5: backlog',
    ].join('\n');
    expect(extractStoryKeysForEpic(yaml, 'EA11')).toEqual(['EA11-S1', 'EA11-S2']);
    expect(extractStoryKeysForEpic(yaml, 'EA10')).toEqual(['EA10-S1']);
  });

  it('rewriteStoryStatus preserves inline comments', () => {
    const yaml = '  EA99-S1: ready-for-dev   # my comment';
    const updated = rewriteStoryStatus(yaml, 'EA99-S1', 'in-progress');
    expect(updated).toBe('  EA99-S1: in-progress   # my comment');
  });
});
