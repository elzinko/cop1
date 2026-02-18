import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';

export interface StatusEntry {
  status: string;
  updatedAt: string;
}

const STATUS_FILE = '.cop1/sprint-status.yaml';

export class YamlStatusStore {
  private readonly filePath: string;

  constructor(projectPath: string) {
    this.filePath = join(projectPath, STATUS_FILE);
  }

  readAll(): Map<string, StatusEntry> {
    if (!existsSync(this.filePath)) {
      return new Map();
    }
    const content = readFileSync(this.filePath, 'utf-8');
    const data = parse(content) as Record<string, StatusEntry> | null;
    return new Map(Object.entries(data ?? {}));
  }

  write(entries: Map<string, StatusEntry>): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const obj = Object.fromEntries(entries);
    writeFileSync(this.filePath, stringify(obj), 'utf-8');
  }
}
