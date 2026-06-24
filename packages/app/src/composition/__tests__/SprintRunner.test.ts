import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import {
  DevAgentStep,
  InMemoryStatusReader,
  PMAgentStep,
  QAAgentStep,
  ReviewerAgentStep,
} from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SprintRunner } from '../SprintRunner.js';

const stubSteps = [
  new DevAgentStep(),
  new ReviewerAgentStep(),
  new QAAgentStep(),
  new PMAgentStep(),
];

function createTempProject(): string {
  const dir = join(tmpdir(), `cop1-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.cop1'), { recursive: true });

  // Create minimal stories (BMADReader scans _bmad-output/implementation-artifacts/)
  const storiesDir = join(dir, '_bmad-output', 'implementation-artifacts');
  mkdirSync(storiesDir, { recursive: true });

  writeFileSync(
    join(storiesDir, 'E1-S1.md'),
    '# Story E1-S1: Test Story A\n\nStatus: ready-for-dev\n\n## Acceptance Criteria\n- AC1: works',
  );
  writeFileSync(
    join(storiesDir, 'E1-S2.md'),
    '# Story E1-S2: Test Story B\n\nStatus: ready-for-dev\n\n## Acceptance Criteria\n- AC1: works',
  );
  writeFileSync(
    join(storiesDir, 'E2-S1.md'),
    '# Story E2-S1: Test Story C\n\nStatus: ready-for-dev\n\n## Acceptance Criteria\n- AC1: works',
  );

  return dir;
}

function createGitProject(): string {
  const dir = createTempProject();

  // Initialize git repo for worktree support. Set a LOCAL identity so the commit
  // is hermetic — no dependency on ambient global git config (a fresh CI runner
  // or a new contributor's machine has none).
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@cop1.local"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "cop1 test"', { cwd: dir, stdio: 'pipe' });
  execSync('git add -A', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "init" --no-gpg-sign', { cwd: dir, stdio: 'pipe' });

  return dir;
}

describe('SprintRunner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = createTempProject();
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
  });

  it('should run all eligible stories through the workflow', async () => {
    const statusReader = new InMemoryStatusReader(
      new Map([
        ['E1-S1', 'ready-for-dev'],
        ['E1-S2', 'ready-for-dev'],
        ['E2-S1', 'ready-for-dev'],
      ]),
    );
    const runner = new SprintRunner({ projectPath, steps: stubSteps, statusReader });
    const result = await runner.run();

    expect(result.dryRun).toBe(false);
    expect(result.storiesDone).toBe(3);
    expect(result.storiesFailed).toBe(0);
    expect(result.storiesProcessed).toBe(3);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('should not process stories already done in reader', async () => {
    const statusReader = new InMemoryStatusReader(
      new Map([
        ['E1-S1', 'done'],
        ['E1-S2', 'ready-for-dev'],
        ['E2-S1', 'ready-for-dev'],
      ]),
    );
    const runner = new SprintRunner({ projectPath, steps: stubSteps, statusReader });
    const result = await runner.run();

    expect(result.storiesDone).toBe(2);
    expect(result.storiesProcessed).toBe(2);
  });

  it('should support dry-run mode without changing anything', async () => {
    const statusReader = new InMemoryStatusReader(
      new Map([
        ['E1-S1', 'ready-for-dev'],
        ['E1-S2', 'ready-for-dev'],
        ['E2-S1', 'ready-for-dev'],
      ]),
    );
    const runner = new SprintRunner({ projectPath, steps: stubSteps, statusReader });
    const result = await runner.run({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.storiesProcessed).toBe(0);
    expect(result.storiesDone).toBe(0);
  });

  it('should filter stories by pattern', async () => {
    const statusReader = new InMemoryStatusReader(
      new Map([
        ['E1-S1', 'ready-for-dev'],
        ['E1-S2', 'ready-for-dev'],
        ['E2-S1', 'ready-for-dev'],
      ]),
    );
    const runner = new SprintRunner({ projectPath, steps: stubSteps, statusReader });
    const result = await runner.run({ filter: 'E1-*' });

    expect(result.storiesDone).toBe(2);
    expect(result.storiesProcessed).toBe(2);
  });

  it('should emit sprint and story.completed events', async () => {
    const statusReader = new InMemoryStatusReader(
      new Map([
        ['E1-S1', 'ready-for-dev'],
        ['E1-S2', 'ready-for-dev'],
        ['E2-S1', 'ready-for-dev'],
      ]),
    );
    const runner = new SprintRunner({ projectPath, steps: stubSteps, statusReader });
    const events: string[] = [];
    const completedStories: string[] = [];

    runner.eventBus.on('sprint.starting', () => events.push('starting'));
    runner.eventBus.on('sprint.completed', () => events.push('completed'));
    runner.eventBus.on('story.completed', (p: unknown) => {
      completedStories.push((p as { storyId: string }).storyId);
    });

    await runner.run();

    expect(events).toContain('starting');
    expect(events).toContain('completed');
    expect(completedStories).toHaveLength(3);
  });

  it('should emit story.completed for each done story', async () => {
    const statusReader = new InMemoryStatusReader(new Map([['E1-S1', 'ready-for-dev']]));
    const runner = new SprintRunner({ projectPath, steps: stubSteps, statusReader });
    const completedStories: string[] = [];
    runner.eventBus.on('story.completed', (p: unknown) => {
      completedStories.push((p as { storyId: string }).storyId);
    });

    await runner.run({ filter: 'E1-S1' });

    expect(completedStories).toEqual(['E1-S1']);
  });

  it('should reject dry-run and simulate together', async () => {
    const runner = new SprintRunner({ projectPath, steps: stubSteps });

    await expect(runner.run({ dryRun: true, simulate: true })).rejects.toThrow(
      '--dry-run and --simulate are mutually exclusive',
    );
  });
});

describe('SprintRunner simulate mode', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = createGitProject();
  });

  afterEach(() => {
    // Clean up worktrees before removing directory
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: projectPath,
        encoding: 'utf-8',
      });
      const worktrees = output
        .split('\n')
        .filter((l) => l.startsWith('worktree '))
        .map((l) => l.replace('worktree ', ''))
        .filter((p) => p !== projectPath);
      for (const wt of worktrees) {
        execSync(`git worktree remove "${wt}" --force`, { cwd: projectPath, stdio: 'pipe' });
      }
    } catch {
      // best effort
    }
    rmSync(projectPath, { recursive: true, force: true });
  });

  it('should create a worktree and execute sprint inside it', async () => {
    const statusReader = new InMemoryStatusReader(
      new Map([
        ['E1-S1', 'ready-for-dev'],
        ['E1-S2', 'ready-for-dev'],
        ['E2-S1', 'ready-for-dev'],
      ]),
    );
    const runner = new SprintRunner({ projectPath, steps: stubSteps, statusReader });
    const result = await runner.run({ simulate: true });

    expect(result.simulate).toBe(true);
    expect(result.worktreePath).toBeDefined();
    expect(result.worktreePath).toContain(join('.cop1', 'worktrees'));
    expect(result.worktreePath).toContain('simulate-');
    expect(result.worktreePath).not.toContain(`${sep}agent${sep}`);
    expect(result.storiesDone).toBe(3);

    // Worktree is preserved (not cleaned up)
    expect(existsSync(result.worktreePath!)).toBe(true);
  });

  it('should not modify main project in simulate mode', async () => {
    const statusReader = new InMemoryStatusReader(new Map([['E1-S1', 'ready-for-dev']]));
    const runner = new SprintRunner({ projectPath, steps: stubSteps, statusReader });
    const result = await runner.run({ simulate: true, filter: 'E1-S1' });

    expect(result.simulate).toBe(true);
    expect(result.storiesDone).toBe(1);
  });

  it('should support simulate with filter', async () => {
    const statusReader = new InMemoryStatusReader(new Map([['E2-S1', 'ready-for-dev']]));
    const runner = new SprintRunner({ projectPath, steps: stubSteps, statusReader });
    const result = await runner.run({ simulate: true, filter: 'E2-*' });

    expect(result.simulate).toBe(true);
    expect(result.storiesDone).toBe(1);
    expect(result.storiesProcessed).toBe(1);
  });

  it('should emit simulate worktree events', async () => {
    const statusReader = new InMemoryStatusReader(new Map([['E1-S1', 'ready-for-dev']]));
    const runner = new SprintRunner({ projectPath, steps: stubSteps, statusReader });
    const events: string[] = [];

    runner.eventBus.on('simulate.worktree.creating', () => events.push('creating'));
    runner.eventBus.on('simulate.worktree.created', () => events.push('created'));

    await runner.run({ simulate: true });

    expect(events).toContain('creating');
    expect(events).toContain('created');
  });
});
