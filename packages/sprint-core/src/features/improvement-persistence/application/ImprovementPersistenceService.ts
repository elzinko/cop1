import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ImprovementDecision {
  id: string;
  type: string;
  description: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
  updatedAt: string;
}

const DECISIONS_FILE = '.cop1/improvement-decisions.jsonl';

export class ImprovementPersistenceService {
  persist(projectPath: string, decision: ImprovementDecision): void {
    const dir = join(projectPath, '.cop1');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const filePath = join(projectPath, DECISIONS_FILE);
    appendFileSync(filePath, `${JSON.stringify(decision)}\n`, 'utf-8');
  }

  loadAll(projectPath: string): ImprovementDecision[] {
    const filePath = join(projectPath, DECISIONS_FILE);
    if (!existsSync(filePath)) {
      return [];
    }

    const content = readFileSync(filePath, 'utf-8').trim();
    if (!content) {
      return [];
    }

    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as ImprovementDecision);
  }

  updateStatus(
    projectPath: string,
    id: string,
    status: ImprovementDecision['status'],
  ): ImprovementDecision | null {
    const decisions = this.loadAll(projectPath);
    const decision = decisions.find((d) => d.id === id);
    if (!decision) {
      return null;
    }

    decision.status = status;
    decision.updatedAt = new Date().toISOString();

    const filePath = join(projectPath, DECISIONS_FILE);
    const content = `${decisions.map((d) => JSON.stringify(d)).join('\n')}\n`;
    writeFileSync(filePath, content, 'utf-8');

    return decision;
  }
}
