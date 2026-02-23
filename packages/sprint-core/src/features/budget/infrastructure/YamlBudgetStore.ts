import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import type { BudgetData, BudgetStorePort } from '../domain/ports/BudgetStorePort.js';

/** Filesystem adapter that persists daily budget data to `.cop1/budget-{date}.yaml`. */
export class YamlBudgetStore implements BudgetStorePort {
  private readonly dirPath: string;

  constructor(projectPath: string) {
    this.dirPath = join(projectPath, '.cop1');
  }

  /** Load budget data for the given date. Returns undefined if file does not exist. */
  load(date: string): BudgetData | undefined {
    const filePath = this.filePath(date);
    if (!existsSync(filePath)) return undefined;

    const content = readFileSync(filePath, 'utf-8');
    const raw = parse(content) as Record<string, unknown> | null;
    if (!raw) return undefined;

    return {
      date: String(raw['date'] ?? date),
      totalConsumed: Number(raw['total_consumed'] ?? 0),
      breakdownByCommand: (raw['breakdown_by_command'] as Record<string, number>) ?? {},
      breakdownByAgent: (raw['breakdown_by_agent'] as Record<string, number>) ?? {},
      events: (raw['events'] as BudgetData['events']) ?? [],
    };
  }

  /** Save budget data atomically (write .tmp then rename). */
  save(data: BudgetData): void {
    if (!existsSync(this.dirPath)) {
      mkdirSync(this.dirPath, { recursive: true });
    }
    const filePath = this.filePath(data.date);
    const yamlContent = stringify({
      date: data.date,
      total_consumed: data.totalConsumed,
      breakdown_by_command: data.breakdownByCommand,
      breakdown_by_agent: data.breakdownByAgent,
      events: data.events,
    });
    const tmpPath = `${filePath}.tmp`;
    writeFileSync(tmpPath, yamlContent, 'utf-8');
    renameSync(tmpPath, filePath);
  }

  private filePath(date: string): string {
    return join(this.dirPath, `budget-${date}.yaml`);
  }
}
