import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSidecarAdapter } from '../infrastructure/FileSidecarAdapter.js';

describe('FileSidecarAdapter', () => {
  let testDir: string;
  let adapter: FileSidecarAdapter;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-sidecar-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    adapter = new FileSidecarAdapter(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should create sidecar directory when missing and write content', () => {
    const sidecarDir = join(testDir, '_bmad', '_memory', 'iamthelaw-sidecar');
    expect(existsSync(sidecarDir)).toBe(false);

    adapter.write('# Test Content\n');

    expect(existsSync(sidecarDir)).toBe(true);
    const filePath = join(sidecarDir, 'rules.md');
    expect(readFileSync(filePath, 'utf-8')).toBe('# Test Content\n');
  });

  it('should not fail when directory already exists', () => {
    adapter.write('First call');
    adapter.write('Second call');

    const sidecarDir = join(testDir, '_bmad', '_memory', 'iamthelaw-sidecar');
    expect(existsSync(sidecarDir)).toBe(true);
  });

  it('should write content atomically with no leftover .tmp file', () => {
    adapter.write('# Atomic Content\n');

    const filePath = join(testDir, '_bmad', '_memory', 'iamthelaw-sidecar', 'rules.md');
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf-8')).toBe('# Atomic Content\n');
    expect(existsSync(`${filePath}.tmp`)).toBe(false);
  });

  it('should overwrite existing content', () => {
    adapter.write('First version');
    adapter.write('Second version');

    const filePath = join(testDir, '_bmad', '_memory', 'iamthelaw-sidecar', 'rules.md');
    expect(readFileSync(filePath, 'utf-8')).toBe('Second version');
  });
});
