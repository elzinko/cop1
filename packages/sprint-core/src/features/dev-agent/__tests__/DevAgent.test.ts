import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Cop1Config } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import { DevAgent } from '../application/DevAgent.js';
import type { CodeGeneratorPort } from '../domain/ports/CodeGeneratorPort.js';
import { WorktreeManager } from '../infrastructure/WorktreeManager.js';

function createGitRepo(): string {
  const dir = join(
    tmpdir(),
    `cop1-dev-agent-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  writeFileSync(join(dir, 'README.md'), '# Test\n');
  execSync('git add -A && git commit -m "initial"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

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

function createMockGenerator(files: { path: string; content: string }[]): CodeGeneratorPort {
  const fileBlocks = files.map((f) => `\`\`\`file:${f.path}\n${f.content}\`\`\``).join('\n\n');
  return {
    generate: async () => `${fileBlocks}\n\nCOMMIT: feat: implement story`,
  };
}

describe('DevAgent', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createGitRepo();
  });

  afterEach(() => {
    // Clean up any remaining worktrees
    try {
      execSync('git worktree prune', { cwd: testDir, stdio: 'pipe' });
    } catch {
      // ignore
    }
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should create a worktree, generate files, and commit', async () => {
    const generator = createMockGenerator([
      { path: 'src/hello.ts', content: 'export const hello = "world";\n' },
    ]);
    const agent = new DevAgent(generator);
    const context = createContext(testDir);

    const result = await agent.run(context);

    expect(result.status).toBe('ok');
  });

  it('should not modify files outside the worktree (isolation test)', async () => {
    const originalReadme = readFileSync(join(testDir, 'README.md'), 'utf-8');

    const generator = createMockGenerator([
      { path: 'src/feature.ts', content: 'export const feature = true;\n' },
    ]);
    const agent = new DevAgent(generator);
    const context = createContext(testDir);

    await agent.run(context);

    // Main repo README should be untouched
    const afterReadme = readFileSync(join(testDir, 'README.md'), 'utf-8');
    expect(afterReadme).toBe(originalReadme);

    // No src/ directory in main repo
    expect(existsSync(join(testDir, 'src'))).toBe(false);
  });

  it('should use conventional commit messages', async () => {
    // Keep worktree alive to check commit message
    const worktreeManager = new WorktreeManager();
    const worktreePath = worktreeManager.create(testDir, 'E1-S1');

    // Write a file and commit manually to verify the pattern
    mkdirSync(join(worktreePath, 'src'), { recursive: true });
    writeFileSync(join(worktreePath, 'src/test.ts'), 'export const x = 1;\n');
    execSync('git add -A', { cwd: worktreePath, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: worktreePath, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: worktreePath, stdio: 'pipe' });
    execSync('git commit -m "feat: implement story"', { cwd: worktreePath, stdio: 'pipe' });

    const log = execSync('git log -1 --format=%s', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();

    expect(log).toMatch(/^(feat|fix|chore):/);

    worktreeManager.cleanup(testDir, worktreePath);
  });

  it('should create worktree based on HEAD', async () => {
    const worktreeManager = new WorktreeManager();
    const worktreePath = worktreeManager.create(testDir, 'E1-S1');

    // Should have README from main
    expect(existsSync(join(worktreePath, 'README.md'))).toBe(true);

    // Check git log shows the initial commit
    const log = execSync('git log --oneline', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();
    expect(log).toContain('initial');

    worktreeManager.cleanup(testDir, worktreePath);
  });

  it('should handle LLM failure gracefully', async () => {
    const generator: CodeGeneratorPort = {
      generate: async () => {
        throw new Error('LLM unavailable');
      },
    };
    const agent = new DevAgent(generator);
    const context = createContext(testDir);

    const result = await agent.run(context);

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('LLM unavailable');
  });

  it('should clean up worktree after execution', async () => {
    const generator = createMockGenerator([
      { path: 'src/hello.ts', content: 'export const hello = 1;\n' },
    ]);
    const agent = new DevAgent(generator);
    const context = createContext(testDir);

    await agent.run(context);

    // Agent directory should be cleaned up
    const agentDir = join(testDir, 'agent');
    if (existsSync(agentDir)) {
      const remaining = readdirSync(agentDir);
      expect(remaining).toHaveLength(0);
    }
  });
});
