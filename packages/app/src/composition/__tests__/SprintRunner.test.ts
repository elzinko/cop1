import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { YamlStatusStore } from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SprintRunner } from '../SprintRunner.js';

function createTempProject(): string {
  const dir = join(tmpdir(), `cop1-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.cop1'), { recursive: true });

  // Create minimal stories
  const storiesDir = join(dir, '_bmad-output', 'planning-artifacts', 'stories', 'sprint-0');
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

describe('SprintRunner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = createTempProject();
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
  });

  it('should run all eligible stories through the workflow', async () => {
    const runner = new SprintRunner(projectPath);
    const result = await runner.run();

    expect(result.dryRun).toBe(false);
    expect(result.storiesDone).toBe(3);
    expect(result.storiesFailed).toBe(0);
    expect(result.storiesProcessed).toBe(3);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('should not process stories already done in tracker', async () => {
    // Pre-set E1-S1 as done
    const store = new YamlStatusStore(projectPath);
    const entries = store.readAll();
    entries.set('E1-S1', { status: 'done', updatedAt: new Date().toISOString() });
    store.write(entries);

    const runner = new SprintRunner(projectPath);
    const result = await runner.run();

    expect(result.storiesDone).toBe(2);
    expect(result.storiesProcessed).toBe(2);
  });

  it('should support dry-run mode without changing anything', async () => {
    const runner = new SprintRunner(projectPath);
    const result = await runner.run({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.storiesProcessed).toBe(0);
    expect(result.storiesDone).toBe(0);

    // Verify no status was changed
    const store = new YamlStatusStore(projectPath);
    const entries = store.readAll();
    expect(entries.size).toBe(0);
  });

  it('should filter stories by pattern', async () => {
    const runner = new SprintRunner(projectPath);
    const result = await runner.run({ filter: 'E1-*' });

    expect(result.storiesDone).toBe(2);
    expect(result.storiesProcessed).toBe(2);
  });

  it('should emit sprint events', async () => {
    const runner = new SprintRunner(projectPath);
    const events: string[] = [];

    runner.eventBus.on('sprint.starting', () => events.push('starting'));
    runner.eventBus.on('sprint.completed', () => events.push('completed'));

    await runner.run();

    expect(events).toContain('starting');
    expect(events).toContain('completed');
  });

  it('should transition stories through all status steps', async () => {
    const runner = new SprintRunner(projectPath);
    await runner.run({ filter: 'E1-S1' });

    const store = new YamlStatusStore(projectPath);
    const entries = store.readAll();
    const status = entries.get('E1-S1');

    expect(status).toBeDefined();
    expect(status?.status).toBe('done');
  });
});
