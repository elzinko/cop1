import { existsSync, readdirSync } from 'node:fs';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RoundTableParticipant } from '../../round-table/domain/RoundTableTypes.js';
import { ScrumMasterAgent } from '../application/ScrumMasterAgent.js';

function createParticipant(name: string, position: string): RoundTableParticipant {
  return { name, contribute: async () => position };
}

describe('ScrumMasterAgent', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-sm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should facilitate a ceremony and return a report', async () => {
    const sm = new ScrumMasterAgent(testDir);
    const participants = [
      createParticipant('dev', 'Implement feature A'),
      createParticipant('reviewer', 'Implement feature A with validation'),
    ];

    const report = await sm.facilitate('planning', 'sprint planning', participants);

    expect(report.ceremonyType).toBe('planning');
    expect(report.participants).toEqual(['dev', 'reviewer']);
    expect(report.summary).toBeTruthy();
    expect(report.decisions.length).toBeGreaterThan(0);
  });

  it('should persist ceremony report to disk', async () => {
    const sm = new ScrumMasterAgent(testDir);
    const participants = [createParticipant('dev', 'yes'), createParticipant('qa', 'yes')];

    await sm.facilitate('planning', 'topic', participants);

    const dir = join(testDir, '.cop1', 'ceremonies');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^planning-/);
  });

  it('should persist retrospective to retro-reports dir', async () => {
    const sm = new ScrumMasterAgent(testDir);
    const participants = [createParticipant('dev', 'good sprint')];

    await sm.facilitate('retrospective', 'sprint retro', participants);

    const dir = join(testDir, '.cop1', 'retro-reports');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    expect(files.length).toBe(1);
  });

  it('should include all participants in report', async () => {
    const sm = new ScrumMasterAgent(testDir);
    const participants = [
      createParticipant('dev', 'pos1'),
      createParticipant('qa', 'pos2'),
      createParticipant('pm', 'pos3'),
    ];

    const report = await sm.facilitate('review', 'review', participants);

    expect(report.participants).toEqual(['dev', 'qa', 'pm']);
  });
});
