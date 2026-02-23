import type { Rule, RuleSet } from '../domain/RuleSet.js';
import type { RuleLoaderPort } from '../domain/ports/RuleLoaderPort.js';
import type { SidecarSyncPort } from '../domain/ports/SidecarSyncPort.js';

/** Service that syncs iamthelaw governance rules to BMAD sidecar memory as LLM-friendly markdown. */
export class SidecarSyncService {
  constructor(
    private readonly loader: RuleLoaderPort,
    private readonly sidecarPort: SidecarSyncPort,
  ) {}

  /** Load rules and write them as markdown to the sidecar location. */
  sync(): void {
    const ruleSet = this.loader.load();
    const markdown = this.formatRuleSetToMarkdown(ruleSet);
    this.sidecarPort.write(markdown);
  }

  private formatRuleSetToMarkdown(ruleSet: RuleSet): string {
    const timestamp = new Date().toISOString();
    const lines: string[] = [];

    lines.push(`> Last synced: ${timestamp}`);
    lines.push('');
    lines.push('# cop1 Governance Rules');
    lines.push('');

    const hasAnyRules =
      ruleSet.global.length > 0 ||
      ruleSet.scrum.length > 0 ||
      ruleSet.architecture.length > 0 ||
      Object.keys(ruleSet.agents).length > 0;

    if (!hasAnyRules) {
      lines.push('No governance rules defined.');
      lines.push('');
      return lines.join('\n');
    }

    if (ruleSet.global.length > 0) {
      lines.push('## Global Rules');
      lines.push('');
      this.appendRules(lines, ruleSet.global);
    }

    if (ruleSet.scrum.length > 0) {
      lines.push('## Scrum Rules');
      lines.push('');
      this.appendRules(lines, ruleSet.scrum);
    }

    if (ruleSet.architecture.length > 0) {
      lines.push('## Architecture Rules');
      lines.push('');
      this.appendRules(lines, ruleSet.architecture);
    }

    const agentNames = Object.keys(ruleSet.agents).sort();
    if (agentNames.length > 0) {
      lines.push('## Agent Rules');
      lines.push('');
      for (const agentName of agentNames) {
        const agentRules = ruleSet.agents[agentName];
        if (agentRules && agentRules.length > 0) {
          lines.push(`### ${agentName}`);
          lines.push('');
          this.appendRules(lines, agentRules);
        }
      }
    }

    return lines.join('\n');
  }

  private appendRules(lines: string[], rules: Rule[]): void {
    for (const rule of rules) {
      lines.push(`- **${rule.id}**: ${rule.description} (source: ${rule.source})`);
    }
    lines.push('');
  }
}
