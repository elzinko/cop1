import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { IamTheLawLoader } from '../application/IamTheLawLoader.js';

describe('IamTheLawLoader', () => {
  let testDir: string;
  let loader: IamTheLawLoader;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-law-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testDir, 'iamthelaw/agents'), { recursive: true });
    loader = new IamTheLawLoader(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should load rules from yaml files', () => {
    writeFileSync(
      join(testDir, 'iamthelaw/global.yaml'),
      stringify({ rules: [{ id: 'G1', description: 'No force push', source: 'team' }] }),
    );

    const ruleSet = loader.load();
    expect(ruleSet.global).toHaveLength(1);
    expect(ruleSet.global[0]?.id).toBe('G1');
  });

  it('should return empty arrays for missing files', () => {
    const ruleSet = loader.load();
    expect(ruleSet.global).toHaveLength(0);
    expect(ruleSet.scrum).toHaveLength(0);
    expect(ruleSet.architecture).toHaveLength(0);
  });

  it('should load agent-specific rules', () => {
    writeFileSync(
      join(testDir, 'iamthelaw/agents/dev-agent.yaml'),
      stringify({ rules: [{ id: 'A1', description: 'Always test', source: 'retro' }] }),
    );

    const ruleSet = loader.load();
    expect(ruleSet.agents['dev-agent']).toHaveLength(1);
  });

  it('should append history entries atomically', () => {
    loader.appendHistory({
      id: 'H1',
      added_at: '2026-02-18T00:00:00Z',
      added_by: 'system',
      source: 'retro',
      rationale: 'Team agreed',
      status: 'active',
    });

    const content = readFileSync(join(testDir, 'iamthelaw/history.jsonl'), 'utf-8');
    const entry = JSON.parse(content.trim());
    expect(entry.id).toBe('H1');
  });
});
