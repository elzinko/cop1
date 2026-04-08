import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BmadStatusReader } from '../infrastructure/BmadStatusReader.js';

describe('BmadStatusReader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cop1-bmad-reader-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeStatusYaml(content: string): void {
    const dir = join(tmpDir, '_bmad-output', 'implementation-artifacts');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'sprint-status.yaml'), content);
  }

  it('should read BMAD-format YAML correctly', () => {
    writeStatusYaml(`
development_status:
  E1-S1: done
  E1-S2: in-progress
  EA2-S3: backlog
`);

    const reader = new BmadStatusReader(tmpDir);
    const statuses = reader.getAllStatuses();

    expect(statuses.size).toBe(3);
    expect(statuses.get('E1-S1')).toBe('done');
    expect(statuses.get('E1-S2')).toBe('in-progress');
    expect(statuses.get('EA2-S3')).toBe('backlog');
  });

  it('should filter out epic-* and *-retrospective keys', () => {
    writeStatusYaml(`
development_status:
  epic-1: done
  E1-S1: done
  epic-1-retrospective: done
  epic-ea1: in-progress
  EA1-S1: ready-for-dev
  epic-ea1-retrospective: optional
`);

    const reader = new BmadStatusReader(tmpDir);
    const statuses = reader.getAllStatuses();

    expect(statuses.size).toBe(2);
    expect(statuses.has('epic-1')).toBe(false);
    expect(statuses.has('epic-1-retrospective')).toBe(false);
    expect(statuses.has('epic-ea1')).toBe(false);
    expect(statuses.has('epic-ea1-retrospective')).toBe(false);
    expect(statuses.get('E1-S1')).toBe('done');
    expect(statuses.get('EA1-S1')).toBe('ready-for-dev');
  });

  it('should return empty Map when file is missing', () => {
    const reader = new BmadStatusReader(tmpDir);
    const statuses = reader.getAllStatuses();

    expect(statuses.size).toBe(0);
  });

  it('should return empty Map when development_status is empty', () => {
    writeStatusYaml(`
development_status:
`);

    const reader = new BmadStatusReader(tmpDir);
    const statuses = reader.getAllStatuses();

    expect(statuses.size).toBe(0);
  });

  it('should handle all status values', () => {
    writeStatusYaml(`
development_status:
  S1: backlog
  S2: ready-for-dev
  S3: in-progress
  S4: review
  S5: done
`);

    const reader = new BmadStatusReader(tmpDir);
    const statuses = reader.getAllStatuses();

    expect(statuses.size).toBe(5);
    expect(statuses.get('S1')).toBe('backlog');
    expect(statuses.get('S2')).toBe('ready-for-dev');
    expect(statuses.get('S3')).toBe('in-progress');
    expect(statuses.get('S4')).toBe('review');
    expect(statuses.get('S5')).toBe('done');
  });

  it('should return correct status for getStoryStatus()', () => {
    writeStatusYaml(`
development_status:
  E1-S1: done
  E1-S2: backlog
`);

    const reader = new BmadStatusReader(tmpDir);

    expect(reader.getStoryStatus('E1-S1')).toBe('done');
    expect(reader.getStoryStatus('E1-S2')).toBe('backlog');
    expect(reader.getStoryStatus('NONEXISTENT')).toBeNull();
  });
});
