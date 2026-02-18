import { execSync } from 'node:child_process';
import type { AnalysisResult, Violation } from '../domain/AnalysisResult.js';

export class StaticAnalysisGate {
  check(worktreePath: string): AnalysisResult {
    const violations: Violation[] = [];

    violations.push(...this.runBiome(worktreePath));
    violations.push(...this.runDependencyCruiser(worktreePath));

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  private runBiome(cwd: string): Violation[] {
    try {
      execSync('npx biome check . --reporter=json', {
        cwd,
        stdio: 'pipe',
        timeout: 60_000,
      });
      return [];
    } catch (error) {
      return this.parseBiomeOutput(error);
    }
  }

  private runDependencyCruiser(cwd: string): Violation[] {
    try {
      execSync('npx depcruise --validate src', {
        cwd,
        stdio: 'pipe',
        timeout: 60_000,
      });
      return [];
    } catch (error) {
      return this.parseDepcruiseOutput(error);
    }
  }

  private parseBiomeOutput(error: unknown): Violation[] {
    const stderr = this.extractStderr(error);
    if (!stderr) return [];

    return [
      {
        rule: 'biome',
        file: 'unknown',
        message: stderr.slice(0, 500),
      },
    ];
  }

  private parseDepcruiseOutput(error: unknown): Violation[] {
    const stderr = this.extractStderr(error);
    if (!stderr) return [];

    return [
      {
        rule: 'dependency-cruiser',
        file: 'unknown',
        message: stderr.slice(0, 500),
      },
    ];
  }

  private extractStderr(error: unknown): string | null {
    if (error && typeof error === 'object' && 'stderr' in error) {
      const stderr = (error as { stderr: Buffer | string }).stderr;
      return typeof stderr === 'string' ? stderr : stderr.toString('utf-8');
    }
    return null;
  }
}
