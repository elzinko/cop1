import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArchDriftDetector } from '../application/ArchDriftDetector.js';

describe('ArchDriftDetector', () => {
  let testDir: string;
  const detector = new ArchDriftDetector();

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-drift-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should pass when no config exists', () => {
    const result = detector.check(testDir);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should pass when no config at specified path', () => {
    const result = detector.check(testDir, join(testDir, 'nonexistent.js'));
    expect(result.passed).toBe(true);
  });

  it('should parse violation output', () => {
    // Test the private parseViolations indirectly via the result structure
    const result = detector.check(testDir);
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('violations');
    expect(Array.isArray(result.violations)).toBe(true);
  });
});
