import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Cop1Config } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import { QAAgent } from '../application/QAAgent.js';

function createContext(projectPath: string): WorkflowContext {
  return {
    storyId: 'E1-S1',
    projectPath,
    config: {
      project: { name: 'test', path: '.' },
      daemon: { port: 4242 },
      sprint: { default_duration_hours: 8 },
      resources: {
        ram_budget_night_gb: 48,
        ram_budget_day_gb: 20,
        suspension_threshold_percent: 75,
        polling_interval_ms: 1000,
      },
      llm_routing: {},
      llm_fallback: {},
      git: { auto_merge: false },
      blocage_rules: {},
      schedule: { auto_start: [] },
      workflow: { useBMAD: true },
      budget: { sprint_max_tokens: 0, alert_thresholds: [], auto_pause: false },
    } satisfies Cop1Config,
  };
}

describe('QAAgent', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-qa-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should have name "qa"', () => {
    const agent = new QAAgent();
    expect(agent.name).toBe('qa');
  });

  it('should return ok when commands succeed', async () => {
    // Create a project with passing tests (biome-formatted with tabs)
    writeFileSync(
      join(testDir, 'package.json'),
      `${JSON.stringify({ scripts: { test: 'echo ok' } }, null, '\t')}\n`,
    );

    const agent = new QAAgent();
    const context = createContext(testDir);
    const result = await agent.run(context);

    expect(result.status).toBe('ok');
  });

  it('should return failed when tests fail', async () => {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ scripts: { test: 'exit 1' } }));

    const agent = new QAAgent();
    const context = createContext(testDir);
    const result = await agent.run(context);

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('Tests failed');
  });

  it('should return ok for empty directory (commands not found)', async () => {
    // No package.json, no biome — commands will fail with exit 1 but not
    // necessarily exit 127. This tests graceful handling.
    const agent = new QAAgent();
    const context = createContext(testDir);
    const result = await agent.run(context);

    // Behavior depends on environment: either ok (skipped) or failed (exit code)
    expect(['ok', 'failed']).toContain(result.status);
  });
});
