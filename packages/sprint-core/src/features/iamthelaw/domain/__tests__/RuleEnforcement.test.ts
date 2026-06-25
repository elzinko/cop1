import { describe, expect, it } from 'vitest';
import { assembleRuleEnforcement, formatAdvisory } from '../RuleEnforcement.js';
import type { Rule, RuleSet } from '../RuleSet.js';

function emptyRuleSet(): RuleSet {
  return { global: [], scrum: [], architecture: [], agents: {} };
}

describe('assembleRuleEnforcement', () => {
  it('returns empty enforced + advisory for an empty rule set', () => {
    const { enforcedChecks, advisory } = assembleRuleEnforcement(emptyRuleSet());
    expect(enforcedChecks).toEqual([]);
    expect(advisory).toEqual([]);
  });

  it('collects enforced checks across all rule groups', () => {
    const ruleSet: RuleSet = {
      global: [{ id: 'G1', description: 'verify', source: 'team', check: 'verification' }],
      scrum: [{ id: 'S1', description: 'review', source: 'scrum', check: 'review_verdict' }],
      architecture: [{ id: 'A1', description: 'arch', source: 'adr', check: 'arch_check' }],
      agents: {
        dev: [{ id: 'D1', description: 'dev', source: 'retro', check: 'dev_check' }],
      },
    };
    const { enforcedChecks } = assembleRuleEnforcement(ruleSet);
    expect(enforcedChecks).toEqual(['verification', 'review_verdict', 'arch_check', 'dev_check']);
  });

  it('dedups enforced checks that repeat across groups', () => {
    const ruleSet: RuleSet = {
      global: [{ id: 'G1', description: 'verify', source: 'team', check: 'verification' }],
      scrum: [{ id: 'S1', description: 'verify too', source: 'scrum', check: 'verification' }],
      architecture: [],
      agents: {
        dev: [{ id: 'D1', description: 'verify thrice', source: 'retro', check: 'verification' }],
      },
    };
    const { enforcedChecks } = assembleRuleEnforcement(ruleSet);
    expect(enforcedChecks).toEqual(['verification']);
  });

  it('puts rules without a check into advisory and excludes enforced ones', () => {
    const enforced: Rule = {
      id: 'G1',
      description: 'verify',
      source: 'team',
      check: 'verification',
    };
    const advisoryRule: Rule = { id: 'G2', description: 'No force push', source: 'team' };
    const ruleSet: RuleSet = {
      global: [enforced, advisoryRule],
      scrum: [{ id: 'S1', description: 'Small PRs', source: 'scrum' }],
      architecture: [],
      agents: {},
    };
    const { advisory } = assembleRuleEnforcement(ruleSet);
    expect(advisory).toEqual([
      advisoryRule,
      { id: 'S1', description: 'Small PRs', source: 'scrum' },
    ]);
  });
});

describe('formatAdvisory', () => {
  it('returns an empty string when there are no advisory rules', () => {
    expect(formatAdvisory([])).toBe('');
  });

  it('renders each advisory rule as a "- <description> (<source>)" line', () => {
    const rules: Rule[] = [
      { id: 'G2', description: 'No force push', source: 'team' },
      { id: 'S1', description: 'Small PRs', source: 'scrum' },
    ];
    expect(formatAdvisory(rules)).toBe('- No force push (team)\n- Small PRs (scrum)');
  });
});
