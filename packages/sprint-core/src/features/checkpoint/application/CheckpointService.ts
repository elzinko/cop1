import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import type { CheckpointState } from '../domain/CheckpointState.js';

const CHECKPOINT_FILE = '.cop1/checkpoint.yaml';

export class CheckpointService {
  private readonly filePath: string;

  constructor(projectPath: string) {
    this.filePath = join(projectPath, CHECKPOINT_FILE);
  }

  save(state: CheckpointState): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const tmpPath = `${this.filePath}.tmp`;
    writeFileSync(tmpPath, stringify(state), 'utf-8');
    renameSync(tmpPath, this.filePath);
  }

  read(): CheckpointState | null {
    if (!existsSync(this.filePath)) {
      return null;
    }
    const content = readFileSync(this.filePath, 'utf-8');
    return parse(content) as CheckpointState;
  }

  clear(): void {
    if (existsSync(this.filePath)) {
      rmSync(this.filePath);
    }
  }
}
