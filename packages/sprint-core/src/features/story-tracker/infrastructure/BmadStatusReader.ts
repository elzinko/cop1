import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { SprintStatusReaderPort } from '../domain/ports/SprintStatusReaderPort.js';

const BMAD_STATUS_FILE = '_bmad-output/implementation-artifacts/sprint-status.yaml';

const SKIP_PATTERNS = [/^epic-/, /-retrospective$/];

export class BmadStatusReader implements SprintStatusReaderPort {
  private readonly filePath: string;

  constructor(projectPath: string) {
    this.filePath = join(projectPath, BMAD_STATUS_FILE);
  }

  getStoryStatus(storyId: string): string | null {
    const statuses = this.getAllStatuses();
    return statuses.get(storyId) ?? null;
  }

  getAllStatuses(): Map<string, string> {
    if (!existsSync(this.filePath)) {
      return new Map();
    }

    const content = readFileSync(this.filePath, 'utf-8');
    const data = parse(content) as { development_status?: Record<string, string> } | null;
    const devStatus = data?.development_status;

    if (!devStatus) {
      return new Map();
    }

    const result = new Map<string, string>();
    for (const [key, value] of Object.entries(devStatus)) {
      if (SKIP_PATTERNS.some((p) => p.test(key))) continue;
      if (typeof value === 'string') {
        result.set(key, value);
      }
    }

    return result;
  }
}
