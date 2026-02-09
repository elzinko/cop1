import type { RuleModule, Rule, RuleLevel } from './types.js';

/**
 * Rules Engine Formatter
 * Formats rules for LLM consumption (system prompts)
 */

/**
 * Format a single rule for LLM
 */
export function formatRule(rule: Rule): string {
  return `### [${rule.level}] ${rule.title}

${rule.content}`;
}

/**
 * Format a rule module for LLM
 */
export function formatModule(module: RuleModule): string {
  const header = `## ${module.name} (v${module.version})
${module.description}
`;

  const rules = module.rules.map(formatRule).join('\n\n');

  return `${header}\n${rules}`;
}

/**
 * Format multiple modules for LLM system prompt
 * Groups rules by level for clarity
 */
export function formatModulesForLLM(modules: RuleModule[]): string {
  if (modules.length === 0) {
    return 'No specific rules defined.';
  }

  const sections = modules.map(formatModule);

  return `# Agent Behavior Rules

These rules define your behavior. Follow them when executing tasks.

${sections.join('\n\n---\n\n')}

## Rule Levels

- **MUST**: Mandatory rules that must always be followed
- **SHOULD**: Recommended practices that should be followed unless there's a good reason not to
- **MAY**: Optional guidelines that can be followed at your discretion`;
}

/**
 * Get rules summary (count by level)
 */
export function getRulesSummary(modules: RuleModule[]): {
  total: number;
  byLevel: Record<RuleLevel, number>;
} {
  const byLevel: Record<RuleLevel, number> = {
    MUST: 0,
    SHOULD: 0,
    MAY: 0,
  };

  let total = 0;

  for (const module of modules) {
    for (const rule of module.rules) {
      byLevel[rule.level]++;
      total++;
    }
  }

  return { total, byLevel };
}
