import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface DriftViolation {
  from: string;
  to: string;
  rule: string;
}

export interface DriftResult {
  passed: boolean;
  violations: DriftViolation[];
}

export class ArchDriftDetector {
  check(worktreePath: string, configPath?: string): DriftResult {
    const config = configPath ?? join(worktreePath, '.cop1/quality/.dependency-cruiser.js');

    if (!existsSync(config)) {
      return { passed: true, violations: [] };
    }

    try {
      execSync(`npx depcruise --config "${config}" --output-type err src`, {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return { passed: true, violations: [] };
    } catch (error) {
      const output =
        error instanceof Error ? ((error as Error & { stdout?: string }).stdout ?? '') : '';
      const violations = this.parseViolations(output);
      return { passed: violations.length === 0, violations };
    }
  }

  private parseViolations(output: string): DriftViolation[] {
    const violations: DriftViolation[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/(\S+)\s*→\s*(\S+)/);
      if (match?.[1] && match[2]) {
        violations.push({
          from: match[1],
          to: match[2],
          rule: 'cross-feature-import',
        });
      }
    }

    return violations;
  }
}
