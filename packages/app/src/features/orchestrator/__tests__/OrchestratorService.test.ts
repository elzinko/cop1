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

  it('aborts the run before any command when the budget guard trips', async () => {
    const statusPath = await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const aborts: { reason?: string }[] = [];
    bus.on('orchestrator.run.aborted', (p) => aborts.push(p as { reason?: string }));

    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' }));
    const trippedGuard = {
      recordTokens: () => {},
      status: () => ({
        tripped: true as const,
        reason: 'tokens' as const,
        spentTokens: 1,
        elapsedMs: 0,
      }),
    };
    const svc = new OrchestratorService(runner, bus, undefined, undefined, trippedGuard);

    const result = await svc.run({
      playbook: samplePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    expect(result.aborted).toBe(true);
    expect(runner).not.toHaveBeenCalled();
    expect(aborts).toHaveLength(1);
    expect(aborts[0]?.reason).toBe('tokens');
    // No story advanced — statuses untouched.
    const finalStatus = await readFile(statusPath, 'utf-8');
    expect(finalStatus).toContain('EA99-S1: ready-for-dev');
    expect(finalStatus).toContain('EA99-S2: ready-for-dev');
    expect(result.storiesProcessed.every((o) => o.nextStatus === o.previousStatus)).toBe(true);
  });

  it('blocks a story whose per-story budget trips but lets the run CONTINUE', async () => {
    const statusPath = await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const budgetEvents: { storyKey?: string; reason?: string; storyTokens?: number }[] = [];
    const runEvents: unknown[] = [];
    bus.on('orchestrator.story.budget_exceeded', (p) =>
      budgetEvents.push(p as { storyKey?: string; reason?: string; storyTokens?: number }),
    );
    bus.on('orchestrator.run.aborted', (p) => runEvents.push(p));

    // Run-level guard never trips (run continues). spentTokens climbs +100 per
    // status() call so the per-story diff crosses the 50-token story cap quickly.
    let spent = 0;
    const guard = {
      recordTokens: () => {},
      status: () => {
        spent += 100;
        return { tripped: false as const, spentTokens: spent, elapsedMs: 0 };
      },
    };

    const runner = vi.fn(async ({ command }) => ({
      success: true,
      nextStatus: command.includes('create-story') ? 'ready-for-dev' : 'in-review',
    }));
    const svc = new OrchestratorService(runner, bus, undefined, undefined, guard, undefined, {
      maxTokens: 50,
    });

    const result = await svc.run({
      playbook: samplePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    // The run was NOT aborted — both stories appear in the outcomes.
    expect(result.aborted).toBe(false);
    expect(runEvents).toHaveLength(0);
    expect(result.storiesProcessed.map((o) => o.storyKey)).toEqual(['EA99-S1', 'EA99-S2']);

    // Each story is blocked by its own per-story budget.
    const s1 = result.storiesProcessed.find((o) => o.storyKey === 'EA99-S1');
    expect(s1?.nextStatus).toBe('blocked');
    expect(s1?.error).toContain('story budget exceeded');
    expect(s1?.error).toContain('story-tokens');

    // The per-story budget_exceeded event was emitted for the blocked story.
    expect(budgetEvents.length).toBeGreaterThanOrEqual(1);
    expect(budgetEvents[0]?.storyKey).toBe('EA99-S1');
    expect(budgetEvents[0]?.reason).toBe('story-tokens');

    // Status persisted as blocked for the first story.
    const finalStatus = await readFile(statusPath, 'utf-8');
    expect(finalStatus).toContain('EA99-S1: blocked');
  });

  it('a tripped per-story budget on the first story does NOT prevent the next story from running', async () => {
    await seedStatusFile(projectRoot);
    const bus = new EventBus();

    // Story 1 trips (huge per-story spend); story 2 stays cheap and completes.
    // The run-level guard never trips, so the run keeps going to story 2.
    let spent = 0;
    const guard = {
      recordTokens: () => {},
      status: () => ({ tripped: false as const, spentTokens: spent, elapsedMs: 0 }),
    };

    const ran: string[] = [];
    const runner = vi.fn(async ({ storyKey, command }) => {
      ran.push(`${storyKey}:${command}`);
      // Only story 1 burns tokens (crosses the 50 cap on its first command).
      if (storyKey === 'EA99-S1') spent += 100;
      return {
        success: true,
        nextStatus: command.includes('create-story')
          ? 'ready-for-dev'
          : command.includes('dev-story')
            ? 'in-review'
            : 'done',
      };
    });
    const svc = new OrchestratorService(runner, bus, undefined, undefined, guard, undefined, {
      maxTokens: 50,
    });

    const result = await svc.run({
      playbook: samplePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    expect(result.aborted).toBe(false);
    const s1 = result.storiesProcessed.find((o) => o.storyKey === 'EA99-S1');
    const s2 = result.storiesProcessed.find((o) => o.storyKey === 'EA99-S2');
    expect(s1?.nextStatus).toBe('blocked');
    // Story 2 ran its full command sequence and reached done (never tripped).
    expect(s2?.nextStatus).toBe('done');
    expect(ran.some((c) => c.startsWith('EA99-S2:'))).toBe(true);
  });

  it('with no storyBudgetConfig the per-story budget is inert (behavior unchanged)', async () => {
    const statusPath = await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const budgetEvents: unknown[] = [];
    bus.on('orchestrator.story.budget_exceeded', (p) => budgetEvents.push(p));

    // A guard that would trip ANY story budget — but with no config it is never
    // consulted as a StoryBudget. The run-level guard itself never trips.
    let spent = 0;
    const guard = {
      recordTokens: () => {},
      status: () => {
        spent += 1_000_000;
        return { tripped: false as const, spentTokens: spent, elapsedMs: 0 };
      },
    };

    const runner = vi.fn(async ({ command }) => ({
      success: true,
      nextStatus: command.includes('create-story')
        ? 'ready-for-dev'
        : command.includes('dev-story')
          ? 'in-review'
          : 'done',
    }));
    // 6th positional arg (worktreePort) undefined, NO 7th storyBudgetConfig.
    const svc = new OrchestratorService(runner, bus, undefined, undefined, guard);

    const result = await svc.run({
      playbook: samplePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    expect(result.aborted).toBe(false);
    expect(budgetEvents).toHaveLength(0);
    const finalStatus = await readFile(statusPath, 'utf-8');
    expect(finalStatus).toContain('EA99-S1: done');
    expect(finalStatus).toContain('EA99-S2: done');
  });

  it('the run-level budget still aborts the whole run (story budget does not weaken it)', async () => {
    const statusPath = await seedStatusFile(projectRoot);
    const bus = new EventBus();
    const aborts: { reason?: string }[] = [];
    bus.on('orchestrator.run.aborted', (p) => aborts.push(p as { reason?: string }));

    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' }));
    const trippedGuard = {
      recordTokens: () => {},
      status: () => ({
        tripped: true as const,
        reason: 'tokens' as const,
        spentTokens: 1,
        elapsedMs: 0,
      }),
    };
    // Story budget config present too — must NOT prevent the run-level abort.
    const svc = new OrchestratorService(
      runner,
      bus,
      undefined,
      undefined,
      trippedGuard,
      undefined,
      { maxTokens: 999_999 },
    );

    const result = await svc.run({
      playbook: samplePlaybook(),
      epicId: 'EA99',
      projectRoot,
      mode: 'normal',
    });

    expect(result.aborted).toBe(true);
    expect(runner).not.toHaveBeenCalled();
    expect(aborts).toHaveLength(1);
    expect(aborts[0]?.reason).toBe('tokens');
    const finalStatus = await readFile(statusPath, 'utf-8');
    expect(finalStatus).toContain('EA99-S1: ready-for-dev');
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
    expect(logger.mock.calls[0]?.[0]).toMatchObject({ event: 'auto-decision' });
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
