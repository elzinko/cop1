import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnrichmentService } from '../application/EnrichmentService.js';

describe('EnrichmentService', () => {
  let testDir: string;
  let service: EnrichmentService;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-enrich-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    service = new EnrichmentService();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should append a section to an existing snapshot', () => {
    const filePath = join(testDir, 'snapshot.md');
    writeFileSync(filePath, '# Story\n\nOriginal content.\n');

    service.append(filePath, 'Dev Notes', 'Generated code for feature X.');

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('# Story');
    expect(content).toContain('Original content.');
    expect(content).toContain('## Dev Notes');
    expect(content).toContain('Generated code for feature X.');
  });

  it('should preserve existing content when appending', () => {
    const filePath = join(testDir, 'snapshot.md');
    writeFileSync(filePath, '# Story\n\nOriginal.\n');

    service.append(filePath, 'Agent Record', 'Agent 1 completed.');
    service.append(filePath, 'Change Log', 'Added file.ts');

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('Original.');
    expect(content).toContain('## Agent Record');
    expect(content).toContain('## Change Log');
  });

  it('should use atomic write (no .tmp file left after success)', () => {
    const filePath = join(testDir, 'snapshot.md');
    writeFileSync(filePath, '# Story\n');

    service.safeAppend(filePath, 'Notes', 'Test content.');

    expect(existsSync(`${filePath}.tmp`)).toBe(false);
    expect(existsSync(filePath)).toBe(true);
  });

  it('should throw when snapshot does not exist', () => {
    expect(() => {
      service.append(join(testDir, 'nonexistent.md'), 'Notes', 'Content');
    }).toThrow('Snapshot not found');
  });
});
