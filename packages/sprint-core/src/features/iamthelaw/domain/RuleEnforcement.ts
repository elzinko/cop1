import type { Rule, RuleSet } from './RuleSet.js';

/**
 * Partition of a `RuleSet` along the ADR-020 enforcement frontier:
 * - `enforcedChecks` — deduped `DoDCheck` ids opted into by rules that carry a
 *   `check`. These are appended to the runner's DoD criteria (enforced).
 * - `advisory` — rules WITHOUT a `check`. They reach the supervisor as prompt
 *   context (advisory), never as a hard gate.
 */
export interface RuleEnforcement {
  enforcedChecks: string[];
  advisory: Rule[];
}

/** All rule groups of a `RuleSet`, flattened, in a stable order. */
export function flattenRules(ruleSet: RuleSet): Rule[] {
  return [
    ...ruleSet.global,
    ...ruleSet.scrum,
    ...ruleSet.architecture,
    ...Object.values(ruleSet.agents).flat(),
  ];
}

/**
 * Split a `RuleSet` into its enforced `DoDCheck` ids and its advisory rules.
 * Enforced ids are deduped (first occurrence wins) across every group; advisory
 * rules keep their original ordering.
 */
export function assembleRuleEnforcement(ruleSet: RuleSet): RuleEnforcement {
  const enforcedChecks: string[] = [];
  const advisory: Rule[] = [];

  for (const rule of flattenRules(ruleSet)) {
    if (rule.check) {
      if (!enforcedChecks.includes(rule.check)) enforcedChecks.push(rule.check);
    } else {
      advisory.push(rule);
    }
  }

  return { enforcedChecks, advisory };
}

/**
 * Render advisory rules as supervisor-prompt text — one `- <description>
 * (<source>)` line per rule. Empty string when there are no advisory rules so
 * the prompt section stays blank (unchanged behaviour for ruleless projects).
 */
export function formatAdvisory(rules: Rule[]): string {
  return rules.map((rule) => `- ${rule.description} (${rule.source})`).join('\n');
}
