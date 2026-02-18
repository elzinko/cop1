import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';

export interface PendingDecision {
  storyId: string;
  question: string;
  context: string;
  asked_at: string;
  status: 'pending' | 'answered';
  answer?: string;
}

export class PMDecisionService {
  private readonly decisionsDir: string;

  constructor(projectPath: string) {
    this.decisionsDir = join(projectPath, '.cop1/decisions');
  }

  persistQuestion(storyId: string, question: string, context: string): PendingDecision {
    if (!existsSync(this.decisionsDir)) {
      mkdirSync(this.decisionsDir, { recursive: true });
    }

    const decision: PendingDecision = {
      storyId,
      question,
      context,
      asked_at: new Date().toISOString(),
      status: 'pending',
    };

    writeFileSync(join(this.decisionsDir, `${storyId}-pending.yaml`), stringify(decision), 'utf-8');

    return decision;
  }

  getPending(): PendingDecision[] {
    if (!existsSync(this.decisionsDir)) return [];

    return readdirSync(this.decisionsDir)
      .filter((f) => f.endsWith('-pending.yaml'))
      .map((f) => {
        const content = readFileSync(join(this.decisionsDir, f), 'utf-8');
        return parse(content) as PendingDecision;
      })
      .filter((d) => d.status === 'pending');
  }

  answer(storyId: string, response: string): PendingDecision | null {
    const filePath = join(this.decisionsDir, `${storyId}-pending.yaml`);
    if (!existsSync(filePath)) return null;

    const decision = parse(readFileSync(filePath, 'utf-8')) as PendingDecision;
    decision.status = 'answered';
    decision.answer = response;

    writeFileSync(filePath, stringify(decision), 'utf-8');
    return decision;
  }
}
