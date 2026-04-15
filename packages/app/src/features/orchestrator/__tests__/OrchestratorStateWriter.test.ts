import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { OrchestratorStateWriter } from '../infrastructure/OrchestratorStateWriter.js';

describe('OrchestratorStateWriter (EA12-S4 AC4)', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'orchestrator-state-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('write + read round-trip', () => {
    const w = new OrchestratorStateWriter(projectRoot);
    const updated = w.update({ currentStory: 'EA12-S4', currentPhase: 'review' });
    expect(updated).toMatchObject({ currentStory: 'EA12-S4', currentPhase: 'review' });
    expect(updated.updatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(w.read()).toEqual(updated);
  });

  it('merges partial updates into existing state', () => {
    const w = new OrchestratorStateWriter(projectRoot);
    w.update({ currentStory: 'EA12-S1' });
    const after = w.update({ blockers: ['none'] });
    expect(after.currentStory).toBe('EA12-S1');
    expect(after.blockers).toEqual(['none']);
  });

  it('persists as YAML at .cop1/orchestrator-state.yaml', async () => {
    const w = new OrchestratorStateWriter(projectRoot);
    w.update({ currentStory: 'X1' });
    const contents = await readFile(join(projectRoot, '.cop1', 'orchestrator-state.yaml'), 'utf-8');
    const parsed = parse(contents) as Record<string, unknown>;
    expect(parsed.currentStory).toBe('X1');
  });
});
