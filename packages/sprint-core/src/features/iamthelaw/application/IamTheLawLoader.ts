import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Rule, RuleSet } from '../domain/RuleSet.js';

export interface HistoryEntry {
  id: string;
  added_at: string;
  added_by: string;
  source: string;
  rationale: string;
  status: string;
}

export class IamTheLawLoader {
  private readonly lawDir: string;

  constructor(projectPath: string) {
    this.lawDir = join(projectPath, 'iamthelaw');
  }

  load(): RuleSet {
    const ruleSet: RuleSet = {
      global: this.loadFile('global.yaml'),
      scrum: this.loadFile('scrum.yaml'),
      architecture: this.loadFile('architecture.yaml'),
      agents: this.loadAgents(),
    };
    return ruleSet;
  }

  appendHistory(entry: HistoryEntry): void {
    const historyPath = join(this.lawDir, 'history.jsonl');
    if (!existsSync(this.lawDir)) {
      mkdirSync(this.lawDir, { recursive: true });
    }
    appendFileSync(historyPath, `${JSON.stringify(entry)}\n`, 'utf-8');
  }

  private loadFile(filename: string): Rule[] {
    const filePath = join(this.lawDir, filename);
    if (!existsSync(filePath)) return [];
    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = parse(content) as { rules?: Rule[] };
      return data?.rules ?? [];
    } catch {
      return [];
    }
  }

  private loadAgents(): Record<string, Rule[]> {
    const agentsDir = join(this.lawDir, 'agents');
    if (!existsSync(agentsDir)) return {};

    const result: Record<string, Rule[]> = {};
    for (const file of readdirSync(agentsDir).filter((f) => f.endsWith('.yaml'))) {
      const agentName = file.replace('.yaml', '');
      const filePath = join(agentsDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const data = parse(content) as { rules?: Rule[] };
        result[agentName] = data?.rules ?? [];
      } catch {
        result[agentName] = [];
      }
    }
    return result;
  }
}
