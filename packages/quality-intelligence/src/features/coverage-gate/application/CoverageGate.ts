import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CoverageResult } from '../domain/CoverageResult.js';

export class CoverageGate {
  constructor(private readonly threshold: number = 80) {}

  check(worktreePath: string): CoverageResult {
    try {
      execSync('npx vitest run --coverage --reporter=json', {
        cwd: worktreePath,
        stdio: 'pipe',
        timeout: 120_000,
      });
    } catch {
      // vitest may exit non-zero if tests fail — still check coverage
    }

    const coverage = this.parseCoverage(worktreePath);

    return {
      passed: coverage >= this.threshold,
      coverage,
      threshold: this.threshold,
    };
  }

  private parseCoverage(worktreePath: string): number {
    const summaryPath = join(worktreePath, 'coverage', 'coverage-summary.json');
    if (!existsSync(summaryPath)) {
      return 0;
    }

    try {
      const content = JSON.parse(readFileSync(summaryPath, 'utf-8')) as {
        total?: { lines?: { pct?: number } };
      };
      return content.total?.lines?.pct ?? 0;
    } catch {
      return 0;
    }
  }
}
