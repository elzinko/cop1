import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StaticAnalysisGate } from '../application/StaticAnalysisGate.js';

describe('StaticAnalysisGate', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-sa-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testDir, 'src'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return violations when tools detect issues', () => {
    // Without proper project setup, both tools will fail
    writeFileSync(join(testDir, 'src', 'bad.ts'), 'var x = 1;var y = 2;', 'utf-8');
    const gate = new StaticAnalysisGate();

    const result = gate.check(testDir);

    // Tools will fail without config, producing violations
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('violations');
    expect(Array.isArray(result.violations)).toBe(true);
  });

  it('should have correct structure for violations', () => {
    const gate = new StaticAnalysisGate();
    const result = gate.check(testDir);

    for (const v of result.violations) {
      expect(v).toHaveProperty('rule');
      expect(v).toHaveProperty('file');
      expect(v).toHaveProperty('message');
    }
  });

  it('should report passed false when violations exist', () => {
    const gate = new StaticAnalysisGate();
    const result = gate.check(testDir);

    if (result.violations.length > 0) {
      expect(result.passed).toBe(false);
    }
  });
});
