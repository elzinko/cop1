import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { DoDCheckRegistry, DoDContext } from '../domain/DoDCheck.js';

export interface DoDResult {
  passed: boolean;
  failedCriteria: string[];
}

/** A single criterion that did not satisfy, with the check's explanation. */
export interface DoDFailure {
  id: string;
  detail?: string;
}

/** Aggregate verdict of evaluating a criteria list against a registry. */
export interface DoDEvaluation {
  passed: boolean;
  failures: DoDFailure[];
}

export interface DoDSnapshot {
  storyId: string;
  hasTests: boolean;
  testsPass: boolean;
  coverageMet: boolean;
  codeReviewed: boolean;
  documentationUpdated: boolean;
}

export class DoDService {
  /**
   * ADR-020 declarative completion gate: for each criterion id, resolve a
   * `DoDCheck` from the registry and run it against `ctx`. A criterion absent
   * from the registry is **skipped** (not a failure) — mirroring the historical
   * `default: return true` leniency of `checkCriterion`. Failures collect the
   * id and the check's `detail`. `passed` iff no criterion failed.
   */
  async evaluate(
    ctx: DoDContext,
    criteria: string[],
    registry: DoDCheckRegistry,
  ): Promise<DoDEvaluation> {
    const failures: DoDFailure[] = [];
    for (const id of criteria) {
      const check = registry.get(id);
      if (!check) continue; // unknown criterion → skipped (lenient)
      const result = await check.evaluate(ctx);
      if (!result.satisfied) {
        failures.push(result.detail === undefined ? { id } : { id, detail: result.detail });
      }
    }
    return { passed: failures.length === 0, failures };
  }

  validate(snapshot: DoDSnapshot, projectPath: string): DoDResult {
    const criteria = this.loadCriteria(projectPath);
    const failedCriteria: string[] = [];

    for (const criterion of criteria) {
      if (!this.checkCriterion(criterion, snapshot)) {
        failedCriteria.push(criterion);
      }
    }

    return { passed: failedCriteria.length === 0, failedCriteria };
  }

  private checkCriterion(criterion: string, snapshot: DoDSnapshot): boolean {
    switch (criterion) {
      case 'tests_exist':
        return snapshot.hasTests;
      case 'tests_pass':
        return snapshot.testsPass;
      case 'coverage_met':
        return snapshot.coverageMet;
      case 'code_reviewed':
        return snapshot.codeReviewed;
      case 'docs_updated':
        return snapshot.documentationUpdated;
      default:
        return true;
    }
  }

  private loadCriteria(projectPath: string): string[] {
    const globalPath = join(projectPath, 'iamthelaw/global.yaml');
    if (!existsSync(globalPath)) {
      return ['tests_exist', 'tests_pass', 'coverage_met', 'code_reviewed'];
    }
    try {
      const content = readFileSync(globalPath, 'utf-8');
      const data = parse(content) as { dod?: string[] };
      return data?.dod ?? ['tests_exist', 'tests_pass', 'coverage_met', 'code_reviewed'];
    } catch {
      return ['tests_exist', 'tests_pass', 'coverage_met', 'code_reviewed'];
    }
  }
}
