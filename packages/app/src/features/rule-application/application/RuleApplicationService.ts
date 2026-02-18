import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';

export class DuplicateRuleError extends Error {
  constructor(ruleId: string) {
    super(`Duplicate rule: ${ruleId} already exists`);
    this.name = 'DuplicateRuleError';
  }
}

export interface RuleProposal {
  type: 'architecture' | 'team' | 'agent' | 'quality';
  ruleId: string;
  payload: Record<string, unknown>;
  agentId?: string;
}

export interface AuditEntry {
  applied_at: string;
  applied_by: string;
  source_proposal_id: string;
  proposal_type: string;
  target_file: string;
  status: 'applied' | 'failed';
  error?: string;
}

export class RuleApplicationService {
  private readonly lawDir: string;
  private readonly historyPath: string;

  constructor(private readonly projectPath: string) {
    this.lawDir = join(projectPath, 'iamthelaw');
    this.historyPath = join(this.lawDir, 'history.jsonl');
  }

  apply(proposal: RuleProposal): void {
    const targetFile = this.resolveTarget(proposal);

    try {
      this.checkDuplicate(targetFile, proposal.ruleId);
      this.appendRule(targetFile, proposal);
      this.audit({
        applied_at: new Date().toISOString(),
        applied_by: 'system',
        source_proposal_id: proposal.ruleId,
        proposal_type: proposal.type,
        target_file: targetFile,
        status: 'applied',
      });
    } catch (error) {
      this.audit({
        applied_at: new Date().toISOString(),
        applied_by: 'system',
        source_proposal_id: proposal.ruleId,
        proposal_type: proposal.type,
        target_file: targetFile,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private resolveTarget(proposal: RuleProposal): string {
    switch (proposal.type) {
      case 'architecture':
        return join(this.lawDir, 'architecture.yaml');
      case 'team':
        return join(this.lawDir, 'global.yaml');
      case 'agent':
        return join(this.lawDir, 'agents', `${proposal.agentId ?? 'default'}.yaml`);
      case 'quality':
        return join(this.projectPath, '.cop1/quality/rules.yaml');
      default:
        return join(this.lawDir, 'global.yaml');
    }
  }

  private checkDuplicate(targetFile: string, ruleId: string): void {
    if (!existsSync(targetFile)) return;
    const content = readFileSync(targetFile, 'utf-8');
    const data = parse(content) as { rules?: Array<{ id: string }> };
    if (data?.rules?.some((r) => r.id === ruleId)) {
      throw new DuplicateRuleError(ruleId);
    }
  }

  private appendRule(targetFile: string, proposal: RuleProposal): void {
    const dir = join(targetFile, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let data: { rules: Array<Record<string, unknown>> } = { rules: [] };
    if (existsSync(targetFile)) {
      data = (parse(readFileSync(targetFile, 'utf-8')) as typeof data) ?? { rules: [] };
      if (!data.rules) data.rules = [];
    }

    data.rules.push({ id: proposal.ruleId, ...proposal.payload });
    writeFileSync(targetFile, stringify(data), 'utf-8');
  }

  private audit(entry: AuditEntry): void {
    if (!existsSync(this.lawDir)) {
      mkdirSync(this.lawDir, { recursive: true });
    }
    appendFileSync(this.historyPath, `${JSON.stringify(entry)}\n`, 'utf-8');
  }
}
