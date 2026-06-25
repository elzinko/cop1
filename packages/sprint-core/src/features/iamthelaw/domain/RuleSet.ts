export interface Rule {
  id: string;
  description: string;
  source: string;
  /**
   * Opt-in DoD enforcement (ADR-020). When set, this rule's `check` is a
   * `DoDCheck` id that must be satisfied at the story-transition seam — the
   * rule becomes ENFORCED. When absent, the rule is advisory and is injected
   * into the supervisor prompt instead.
   */
  check?: string;
}

export interface RuleSet {
  global: Rule[];
  scrum: Rule[];
  architecture: Rule[];
  agents: Record<string, Rule[]>;
}
