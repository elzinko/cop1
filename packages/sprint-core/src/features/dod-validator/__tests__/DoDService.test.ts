import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import type { DoDSnapshot } from '../application/DoDService.js';
import { DoDService } from '../application/DoDService.js';

describe('DoDService', () => {
  let testDir: string;
  const service = new DoDService();

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-dod-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const passingSnapshot: DoDSnapshot = {
    storyId: 'S1',
    hasTests: true,
    testsPass: true,
    coverageMet: true,
    codeReviewed: true,
    documentationUpdated: true,
  };

  it('should pass when all criteria met', () => {
    const result = service.validate(passingSnapshot, testDir);
    expect(result.passed).toBe(true);
    expect(result.failedCriteria).toHaveLength(0);
  });

  it('should fail when tests do not pass', () => {
    const result = service.validate({ ...passingSnapshot, testsPass: false }, testDir);
    expect(result.passed).toBe(false);
    expect(result.failedCriteria).toContain('tests_pass');
  });

  it('should use custom criteria from iamthelaw config', () => {
    mkdirSync(join(testDir, 'iamthelaw'), { recursive: true });
    writeFileSync(
      join(testDir, 'iamthelaw/global.yaml'),
      stringify({ dod: ['tests_exist', 'docs_updated'] }),
    );

    const result = service.validate(
      { ...passingSnapshot, coverageMet: false, codeReviewed: false },
      testDir,
    );
    expect(result.passed).toBe(true); // only checks tests_exist and docs_updated
  });

  it('should fail multiple criteria', () => {
    const result = service.validate(
      { ...passingSnapshot, hasTests: false, coverageMet: false },
      testDir,
    );
    expect(result.passed).toBe(false);
    expect(result.failedCriteria).toContain('tests_exist');
    expect(result.failedCriteria).toContain('coverage_met');
  });
});
