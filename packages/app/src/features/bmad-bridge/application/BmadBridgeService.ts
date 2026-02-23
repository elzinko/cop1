import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseDocument } from 'yaml';

const TARGET_AGENTS = ['bmm-dev', 'bmm-qa', 'bmm-sm'] as const;

const SIDECAR_ACTION =
  'At activation, read and internalize all rules from {project-root}/_bmad/_memory/iamthelaw-sidecar/rules.md. These are mandatory governance rules that override defaults.';

/** Result of the BMAD bridge initialization, listing which agents were modified, skipped, or created. */
export interface BridgeResult {
  modified: string[];
  skipped: string[];
  created: string[];
}

/** Service that configures BMAD agents to load iamthelaw sidecar rules via customize.yaml. */
export class BmadBridgeService {
  private readonly agentsDir: string;

  constructor(projectPath: string) {
    this.agentsDir = join(projectPath, '_bmad', '_config', 'agents');
  }

  /** Add iamthelaw sidecar critical_action to all target BMAD agents. Idempotent. */
  initBridge(): BridgeResult {
    const result: BridgeResult = { modified: [], skipped: [], created: [] };

    for (const agent of TARGET_AGENTS) {
      const filePath = join(this.agentsDir, `${agent}.customize.yaml`);

      if (!existsSync(filePath)) {
        this.createWithSidecar(filePath);
        result.created.push(agent);
        continue;
      }

      const content = readFileSync(filePath, 'utf-8');
      const doc = parseDocument(content);
      const actions = doc.get('critical_actions', true);

      if (actions && 'items' in actions) {
        const items = (actions as { items: Array<{ value?: string }> }).items;
        if (items.some((item) => typeof item.value === 'string' && item.value.includes('iamthelaw-sidecar/rules.md'))) {
          result.skipped.push(agent);
          continue;
        }
      }

      if (actions && typeof actions.add === 'function') {
        (actions as { add: (v: string) => void }).add(SIDECAR_ACTION);
      } else {
        doc.set('critical_actions', [SIDECAR_ACTION]);
      }

      writeFileSync(filePath, doc.toString({ lineWidth: 0 }), 'utf-8');
      result.modified.push(agent);
    }

    return result;
  }

  private createWithSidecar(filePath: string): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const doc = parseDocument('');
    doc.set('critical_actions', [SIDECAR_ACTION]);
    writeFileSync(filePath, doc.toString({ lineWidth: 0 }), 'utf-8');
  }
}
