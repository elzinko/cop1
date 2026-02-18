import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export interface DoDResult {
  passed: boolean;
  failedCriteria: string[];
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
