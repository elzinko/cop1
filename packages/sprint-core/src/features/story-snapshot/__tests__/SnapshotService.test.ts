import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SnapshotService } from '../application/SnapshotService.js';

describe('SnapshotService', () => {
  let testDir: string;
  let service: SnapshotService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-snap-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    service = new SnapshotService();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should create a snapshot with correct headers', () => {
    const sourceFile = join(testDir, 'source.md');
    writeFileSync(sourceFile, '# Story\n\nSome content.\n');

    const snapshotPath = service.createSnapshot('E1-S1', sourceFile, testDir);
    const content = readFileSync(snapshotPath, 'utf-8');

    expect(content).toContain('<!-- snapshot_at:');
    expect(content).toContain('<!-- source_checksum:');
    expect(content).toContain('<!-- story_id: E1-S1 -->');
    expect(content).toContain('# Story');
    expect(content).toContain('Some content.');
  });

  it('should include correct SHA-256 checksum in header', () => {
    const sourceFile = join(testDir, 'source.md');
    const sourceContent = '# Test Story\n';
    writeFileSync(sourceFile, sourceContent);

    const snapshotPath = service.createSnapshot('E1-S1', sourceFile, testDir);
    const content = readFileSync(snapshotPath, 'utf-8');

    const checksumMatch = content.match(/source_checksum: ([a-f0-9]+)/);
    expect(checksumMatch).not.toBeNull();
    expect(checksumMatch?.[1]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should retrieve snapshot content via getSnapshot', () => {
    const sourceFile = join(testDir, 'source.md');
    writeFileSync(sourceFile, '# Content\n');

    service.createSnapshot('E1-S1', sourceFile, testDir);
    const snapshot = service.getSnapshot('E1-S1', testDir);

    expect(snapshot).toContain('# Content');
  });

  it('should return null for non-existent snapshot', () => {
    expect(service.getSnapshot('nonexistent', testDir)).toBeNull();
  });
});
