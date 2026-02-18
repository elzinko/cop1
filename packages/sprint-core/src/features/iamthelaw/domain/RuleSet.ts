export interface Rule {
  id: string;
  description: string;
  source: string;
}

export interface RuleSet {
  global: Rule[];
  scrum: Rule[];
  architecture: Rule[];
  agents: Record<string, Rule[]>;
}
