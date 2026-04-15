import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { SprintStatusPort } from '../domain/SprintStatusPort.js';

/**
 * Interim file-level adapter for BMAD's sprint-status.yaml.
 *
 * This is the single runtime module allowed to reference
 * `sprint-status.yaml` (enforced by `sprint-status-coupling-invariant.test.ts`).
 *
 * Target architecture (EA12-S4 follow-up, V1.1 backlog): replace with a
 * `BmadCommandStatusAdapter` that invokes `/bmad-bmm-sprint-status` via
 * `invoke_bmad_command` and interprets the output. This will require
 * threading a `BmadCommandInvoker` through all CLI entrypoints + daemon
 * composition.
 */
const BMAD_STATUS_FILE = '_bmad-output/implementation-artifacts/sprint-status.yaml';

const SKIP_PATTERNS = [/^epic-/, /-retrospective$/];

export class YamlSprintStatusAdapter implements SprintStatusPort {
  private readonly filePath: string;

  constructor(projectPath: string) {
    this.filePath = join(projectPath, BMAD_STATUS_FILE);
  }

  getStoryStatus(storyId: string): string | null {
    return this.getAllStatuses().get(storyId) ?? null;
  }

  getAllStatuses(): Map<string, string> {
    if (!existsSync(this.filePath)) return new Map();
    const content = readFileSync(this.filePath, 'utf-8');
    const data = parse(content) as { development_status?: Record<string, string> } | null;
    const devStatus = data?.development_status;
    if (!devStatus) return new Map();
    const result = new Map<string, string>();
    for (const [key, value] of Object.entries(devStatus)) {
      if (SKIP_PATTERNS.some((p) => p.test(key))) continue;
      if (typeof value === 'string') result.set(key, value);
    }
    return result;
  }
}
