/**
 * Rules Engine Types
 * Inspired by iamthelaw but designed for cop1 agents
 */

export enum RuleLevel {
  MUST = 'MUST',
  SHOULD = 'SHOULD',
  MAY = 'MAY',
}

export interface Rule {
  id: string;
  title: string;
  level: RuleLevel;
  content: string;
}

export interface RuleModule {
  name: string;
  version: string;
  description: string;
  tags: string[];
  rules: Rule[];
}

export type ModuleSource = 'core' | 'custom';

export interface RuleModuleWithSource extends RuleModule {
  source: ModuleSource;
}
